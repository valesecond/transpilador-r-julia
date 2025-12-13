/**
 * R to Julia Transpiler
 * Pure JavaScript implementation
 */

class RtoJuliaTranspiler {
    constructor() {
        this.tokens = [];
        this.position = 0;
        this.globalLoopsMap = new Map(); // Para rastrear loops que precisam de 'global'
    }

    /**
     * Main transpile function
     */
    transpile(rCode) {
        try {
            this.tokens = this.tokenize(rCode);
            this.position = 0;
            const ast = this.parseProgram();
            
            // Analyze and transform AST to generate correct Julia code
            this.analyzeAndTransform(ast);
            
            return this.generateCode(ast);
        } catch (error) {
            throw new Error(`Erro de transpilação: ${error.message}`);
        }
    }

    /**
     * Collect functions used in the program for import generation
     */
    collectFunctions(ast, collected = new Set()) {
        if (!ast) return collected;
        
        if (ast.type === 'Program') {
            ast.stmts.forEach(s => this.collectFunctions(s, collected));
        } else if (ast.type === 'FunctionCall') {
            collected.add(ast.name);
            ast.args.forEach(a => this.collectFunctions(a, collected));
            Object.values(ast.kwargs || {}).forEach(v => this.collectFunctions(v, collected));
        } else if (ast.type === 'ExpressionStatement') {
            this.collectFunctions(ast.expr, collected);
        } else if (ast.type === 'Assignment' || ast.type === 'IndexAssignment' || ast.type === 'DollarAssignment') {
            this.collectFunctions(ast.expr, collected);
        } else if (ast.type === 'IfStatement') {
            this.collectFunctions(ast.condition, collected);
            this.collectFunctions(ast.thenBranch, collected);
            this.collectFunctions(ast.elseBranch, collected);
        } else if (ast.type === 'ForLoop' || ast.type === 'WhileLoop') {
            this.collectFunctions(ast.condition || ast.iterable, collected);
            this.collectFunctions(ast.body, collected);
        } else if (ast.type === 'Block') {
            ast.stmts.forEach(s => this.collectFunctions(s, collected));
        } else if (ast.type === 'BinaryOp') {
            this.collectFunctions(ast.left, collected);
            this.collectFunctions(ast.right, collected);
        } else if (ast.type === 'UnaryOp') {
            this.collectFunctions(ast.expr, collected);
        } else if (ast.type === 'IndexAccess') {
            this.collectFunctions(ast.obj, collected);
            this.collectFunctions(ast.index, collected);
        }
        
        return collected;
    }

    /**
     * Generate necessary imports based on functions used
     */
    generateImports(usedFunctions) {
        const importsMap = {
            'mean': 'Statistics',
            'median': 'Statistics',
            'std': 'Statistics',
            'var': 'Statistics',
            'quantile': 'Statistics',
            'sort': 'Base',
            'reverse': 'Base',
            'unique': 'Base',
            'DataFrame': 'DataFrames',
        };
        
        const importsNeeded = new Set();
        usedFunctions.forEach(func => {
            if (importsMap[func]) {
                importsNeeded.add(importsMap[func]);
            }
        });
        
        if (importsNeeded.size === 0) {
            return '';
        }
        
        return Array.from(importsNeeded)
            .sort()
            .map(imp => `using ${imp}`)
            .join('\n');
    }

    /**
     * Analyze AST to find variables that need 'global' declaration in loops
     */
    analyzeVariableScopes(ast) {
        if (ast.type !== 'Program') return new Map();
        
        const globalVars = new Set();
        const loopsNeedingGlobal = new Map(); // loopNode -> Set of vars needing global
        
        // First pass: collect global variables (defined at top level)
        ast.stmts.forEach(stmt => {
            if (stmt.type === 'ExpressionStatement' && stmt.expr.type === 'Assignment') {
                globalVars.add(stmt.expr.name);
            }
        });
        
        // Second pass: check each loop for variable assignments
        const checkLoopVars = (node, parentGlobalVars) => {
            if (!node) return;
            
            if (node.type === 'ForLoop' || node.type === 'WhileLoop') {
                const assignedVars = new Set();
                this._collectAssignments(node.body, assignedVars);
                
                // Find which assigned vars are global
                const globalsInLoop = new Set();
                assignedVars.forEach(varName => {
                    if (parentGlobalVars.has(varName)) {
                        globalsInLoop.add(varName);
                    }
                });
                
                if (globalsInLoop.size > 0) {
                    loopsNeedingGlobal.set(node, globalsInLoop);
                }
                
                // Recursively check nested structures
                checkLoopVars(node.body, parentGlobalVars);
            } else if (node.type === 'Block') {
                node.stmts.forEach(stmt => checkLoopVars(stmt, parentGlobalVars));
            } else if (node.type === 'IfStatement') {
                checkLoopVars(node.thenBranch, parentGlobalVars);
                checkLoopVars(node.elseBranch, parentGlobalVars);
            }
        };
        
        ast.stmts.forEach(stmt => checkLoopVars(stmt, globalVars));
        
        return loopsNeedingGlobal;
    }

    /**
     * Collect all variable assignments in a code block
     */
    _collectAssignments(node, collected = new Set()) {
        if (!node) return collected;
        
        if (node.type === 'ExpressionStatement') {
            if (node.expr.type === 'Assignment') {
                collected.add(node.expr.name);
            }
            this._collectAssignments(node.expr, collected);
        } else if (node.type === 'Block') {
            node.stmts.forEach(stmt => this._collectAssignments(stmt, collected));
        } else if (node.type === 'IfStatement') {
            this._collectAssignments(node.thenBranch, collected);
            this._collectAssignments(node.elseBranch, collected);
        } else if (node.type === 'ForLoop' || node.type === 'WhileLoop') {
            this._collectAssignments(node.body, collected);
        }
        
        return collected;
    }

    /**
     * Analyze and transform AST to generate correct Julia code
     * E.g., if a variable is assigned as array but later indexed with string, convert to Dict
     */
    analyzeAndTransform(ast) {
        if (ast.type !== 'Program') return;
        
        // Track variable types
        const varTypes = {}; // varName -> 'array' | 'dict' | 'unknown'
        const varAssignments = {}; // varName -> assignment index
        
        // First pass: collect assignments
        ast.stmts.forEach((stmt, idx) => {
            if (stmt.type === 'ExpressionStatement' && stmt.expr.type === 'Assignment') {
                const varName = stmt.expr.name;
                varAssignments[varName] = idx;
                varTypes[varName] = 'unknown';
            }
        });
        
        // Second pass: detect string indexing
        ast.stmts.forEach((stmt) => {
            if (stmt.type === 'ExpressionStatement' && stmt.expr.type === 'IndexAssignment') {
                const varName = stmt.expr.target.name;
                if (stmt.expr.index.type === 'StringLiteral') {
                    varTypes[varName] = 'dict';
                }
            }
        });
        
        // Third pass: mark assignments as dict if needed
        ast.stmts.forEach((stmt, idx) => {
            if (stmt.type === 'ExpressionStatement' && stmt.expr.type === 'Assignment') {
                const varName = stmt.expr.name;
                
                // If this variable will be indexed with string later, convert c() to Dict
                if (varTypes[varName] === 'dict') {
                    const expr = stmt.expr.expr;
                    if (expr.type === 'FunctionCall' && expr.name === 'c') {
                        // Mark that this c() call should become a Dict
                        expr._shouldBeDict = true;
                    }
                }
            }
        });
    }

    /**
     * Tokenize R code
     */
    tokenize(code) {
        const tokens = [];
        let i = 0;

        while (i < code.length) {
            // Skip whitespace (except newlines)
            if (/[\t ]/.test(code[i])) {
                i++;
                continue;
            }

            // Newlines
            if (code[i] === '\n') {
                tokens.push({ type: 'NEWLINE', value: '\n' });
                i++;
                continue;
            }

            // Comments
            if (code[i] === '#') {
                const endLine = code.indexOf('\n', i);
                const comment = code.substring(i, endLine === -1 ? code.length : endLine);
                tokens.push({ type: 'COMMENT', value: comment });
                i = endLine === -1 ? code.length : endLine;
                continue;
            }

            // Strings
            if (code[i] === '"' || code[i] === "'") {
                const quote = code[i];
                let j = i + 1;
                let str = '';
                while (j < code.length && code[j] !== quote) {
                    if (code[j] === '\\' && j + 1 < code.length) {
                        str += code[j] + code[j + 1];
                        j += 2;
                    } else {
                        str += code[j];
                        j++;
                    }
                }
                tokens.push({ type: 'STRING', value: str });
                i = j + 1;
                continue;
            }

            // Numbers (including integer literals with L suffix)
            if (/\d/.test(code[i])) {
                let j = i;
                let isFloat = false;
                while (j < code.length && (/\d/.test(code[j]) || (code[j] === '.' && !isFloat))) {
                    if (code[j] === '.') isFloat = true;
                    j++;
                }
                // Check for L suffix (integer literal in R)
                if (j < code.length && (code[j] === 'L' || code[j] === 'l')) {
                    j++;
                    isFloat = false;
                }
                const num = code.substring(i, j);
                tokens.push({
                    type: isFloat ? 'FLOAT' : 'INT',
                    value: num.replace(/[Ll]$/, '') // Remove L suffix for storage
                });
                i = j;
                continue;
            }

            // Assignment operators
            if (code[i] === '<' && code[i + 1] === '-') {
                tokens.push({ type: 'ASSIGN', value: '<-' });
                i += 2;
                continue;
            }

            if (code[i] === '=' && code[i + 1] !== '=') {
                tokens.push({ type: 'ASSIGN', value: '=' });
                i++;
                continue;
            }

            // Comparison operators
            if (code[i] === '=' && code[i + 1] === '=') {
                tokens.push({ type: 'EQ', value: '==' });
                i += 2;
                continue;
            }

            if (code[i] === '!' && code[i + 1] === '=') {
                tokens.push({ type: 'NE', value: '!=' });
                i += 2;
                continue;
            }

            if (code[i] === '<' && code[i + 1] === '=') {
                tokens.push({ type: 'LE', value: '<=' });
                i += 2;
                continue;
            }

            if (code[i] === '>' && code[i + 1] === '=') {
                tokens.push({ type: 'GE', value: '>=' });
                i += 2;
                continue;
            }

            if (code[i] === '<') {
                tokens.push({ type: 'LT', value: '<' });
                i++;
                continue;
            }

            if (code[i] === '>') {
                tokens.push({ type: 'GT', value: '>' });
                i++;
                continue;
            }

            // Logical operators
            if (code[i] === '&' && code[i + 1] === '&') {
                tokens.push({ type: 'AND', value: '&&' });
                i += 2;
                continue;
            }

            if (code[i] === '|' && code[i + 1] === '|') {
                tokens.push({ type: 'OR', value: '||' });
                i += 2;
                continue;
            }

            if (code[i] === '&') {
                tokens.push({ type: 'AND', value: '&' });
                i++;
                continue;
            }

            if (code[i] === '|') {
                tokens.push({ type: 'OR', value: '|' });
                i++;
                continue;
            }

            if (code[i] === '!') {
                tokens.push({ type: 'NOT', value: '!' });
                i++;
                continue;
            }

            // Arithmetic operators
            if (code[i] === '+') {
                tokens.push({ type: 'PLUS', value: '+' });
                i++;
                continue;
            }

            if (code[i] === '-') {
                tokens.push({ type: 'MINUS', value: '-' });
                i++;
                continue;
            }

            if (code[i] === '*') {
                tokens.push({ type: 'MUL', value: '*' });
                i++;
                continue;
            }

            if (code[i] === '/') {
                tokens.push({ type: 'DIV', value: '/' });
                i++;
                continue;
            }

            if (code[i] === '^') {
                tokens.push({ type: 'POW', value: '^' });
                i++;
                continue;
            }

            // Punctuation
            if (code[i] === '(') {
                tokens.push({ type: 'LPAREN', value: '(' });
                i++;
                continue;
            }

            if (code[i] === ')') {
                tokens.push({ type: 'RPAREN', value: ')' });
                i++;
                continue;
            }

            if (code[i] === '{') {
                tokens.push({ type: 'LBRACE', value: '{' });
                i++;
                continue;
            }

            if (code[i] === '}') {
                tokens.push({ type: 'RBRACE', value: '}' });
                i++;
                continue;
            }

            if (code[i] === '[') {
                tokens.push({ type: 'LBRACK', value: '[' });
                i++;
                continue;
            }

            if (code[i] === ']') {
                tokens.push({ type: 'RBRACK', value: ']' });
                i++;
                continue;
            }

            if (code[i] === ',') {
                tokens.push({ type: 'COMMA', value: ',' });
                i++;
                continue;
            }

            if (code[i] === ':') {
                tokens.push({ type: 'COLON', value: ':' });
                i++;
                continue;
            }

            if (code[i] === ';') {
                tokens.push({ type: 'SEMICOLON', value: ';' });
                i++;
                continue;
            }

            if (code[i] === '$') {
                tokens.push({ type: 'DOLLAR', value: '$' });
                i++;
                continue;
            }

            // Identifiers and keywords (including dot notation like is.double)
            if (/[a-zA-Z_]/.test(code[i])) {
                let j = i;
                while (j < code.length && /[a-zA-Z0-9_.]/.test(code[j])) {
                    j++;
                }
                const word = code.substring(i, j);
                const keywords = ['if', 'else', 'for', 'in', 'while', 'function', 'return', 'TRUE', 'FALSE'];
                const type = keywords.includes(word) ? word.toUpperCase() : 'ID';
                tokens.push({ type, value: word });
                i = j;
                continue;
            }

            // Skip unknown characters
            i++;
        }

        return tokens;
    }

    /**
     * Parse program
     */
    parseProgram() {
        const stmts = [];
        while (!this.isAtEnd()) {
            if (this.check('NEWLINE') || this.check('COMMENT')) {
                this.advance();
                continue;
            }
            const stmt = this.parseStatement();
            if (stmt) stmts.push(stmt);
        }
        return { type: 'Program', stmts };
    }

    /**
     * Parse statement
     */
    parseStatement() {
        // Skip newlines and comments
        while (this.check('NEWLINE') || this.check('COMMENT')) {
            this.advance();
        }
        
        if (this.isAtEnd()) {
            return null;
        }
        
        if (this.check('IF')) return this.parseIfStatement();
        if (this.check('FOR')) return this.parseForStatement();
        if (this.check('WHILE')) return this.parseWhileStatement();
        if (this.check('FUNCTION')) return this.parseFunctionDef();
        if (this.check('RETURN')) return this.parseReturnStatement();
        if (this.check('LBRACE')) return this.parseBlock();

        return this.parseExpressionStatement();
    }

    /**
     * Parse if statement
     */
    parseIfStatement() {
        this.consume('IF');
        this.consume('LPAREN');
        const condition = this.parseExpression();
        this.consume('RPAREN');
        const thenBranch = this.parseStatement();
        let elseBranch = null;
        if (this.check('ELSE')) {
            this.advance();
            elseBranch = this.parseStatement();
        }
        return { type: 'IfStatement', condition, thenBranch, elseBranch };
    }

    /**
     * Parse for loop
     */
    parseForStatement() {
        this.consume('FOR');
        this.consume('LPAREN');
        const variable = this.consume('ID').value;
        this.consume('IN');
        const iterable = this.parseExpression();
        this.consume('RPAREN');
        const body = this.parseStatement();
        return { type: 'ForLoop', variable, iterable, body };
    }

    /**
     * Parse while loop
     */
    parseWhileStatement() {
        this.consume('WHILE');
        this.consume('LPAREN');
        const condition = this.parseExpression();
        this.consume('RPAREN');
        const body = this.parseStatement();
        return { type: 'WhileLoop', condition, body };
    }

    /**
     * Parse function definition
     */
    parseFunctionDef() {
        this.consume('FUNCTION');
        this.consume('LPAREN');
        const params = [];
        while (!this.check('RPAREN')) {
            params.push(this.consume('ID').value);
            if (this.check('COMMA')) {
                this.advance();
            }
        }
        this.consume('RPAREN');
        const body = this.parseStatement();
        return { type: 'FunctionDef', params, body };
    }

    /**
     * Parse return statement
     */
    parseReturnStatement() {
        this.consume('RETURN');
        let expr = null;
        if (!this.check('NEWLINE') && !this.isAtEnd() && !this.check('RBRACE')) {
            expr = this.parseExpression();
        }
        return { type: 'ReturnStatement', expr };
    }

    /**
     * Parse block
     */
    parseBlock() {
        this.consume('LBRACE');
        const stmts = [];
        while (!this.check('RBRACE') && !this.isAtEnd()) {
            if (this.check('NEWLINE') || this.check('COMMENT')) {
                this.advance();
                continue;
            }
            const stmt = this.parseStatement();
            if (stmt) stmts.push(stmt);
        }
        this.consume('RBRACE');
        return { type: 'Block', stmts };
    }

    /**
     * Parse expression statement
     */
    parseExpressionStatement() {
        if (this.isAtEnd() || this.check('RBRACE')) {
            return null;
        }
        const expr = this.parseExpression();
        if (this.check('NEWLINE') || this.check('SEMICOLON')) {
            this.advance();
        }
        return { type: 'ExpressionStatement', expr };
    }

    /**
     * Parse expression (assignment or logical or)
     */
    parseExpression() {
        return this.parseAssignment();
    }

    /**
     * Parse assignment
     */
    parseAssignment() {
        let expr = this.parseLogicalOr();

        if (this.check('ASSIGN')) {
            this.advance();
            const right = this.parseAssignment();
            if (expr.type === 'Identifier') {
                return { type: 'Assignment', name: expr.name, expr: right };
            } else if (expr.type === 'IndexAccess') {
                return { type: 'IndexAssignment', target: expr.obj, index: expr.index, expr: right };
            } else if (expr.type === 'DollarAccess') {
                return { type: 'DollarAssignment', target: expr.obj, field: expr.field, expr: right };
            }
        }

        return expr;
    }

    /**
     * Parse logical OR
     */
    parseLogicalOr() {
        let expr = this.parseLogicalAnd();

        while (this.check('OR')) {
            const op = this.advance().value;
            const right = this.parseLogicalAnd();
            expr = { type: 'BinaryOp', left: expr, op, right };
        }

        return expr;
    }

    /**
     * Parse logical AND
     */
    parseLogicalAnd() {
        let expr = this.parseComparison();

        while (this.check('AND')) {
            const op = this.advance().value;
            const right = this.parseComparison();
            expr = { type: 'BinaryOp', left: expr, op, right };
        }

        return expr;
    }

    /**
     * Parse comparison
     */
    parseComparison() {
        let expr = this.parseAdditive();

        while (this.check('EQ') || this.check('NE') || this.check('LT') || 
               this.check('LE') || this.check('GT') || this.check('GE')) {
            const op = this.advance().value;
            const right = this.parseAdditive();
            expr = { type: 'BinaryOp', left: expr, op, right };
        }

        return expr;
    }

    /**
     * Parse additive (+ -)
     */
    parseAdditive() {
        let expr = this.parseMultiplicative();

        while (this.check('PLUS') || this.check('MINUS')) {
            const op = this.advance().value;
            const right = this.parseMultiplicative();
            expr = { type: 'BinaryOp', left: expr, op, right };
        }

        return expr;
    }

    /**
     * Parse multiplicative (* /)
     */
    parseMultiplicative() {
        let expr = this.parsePower();

        while (this.check('MUL') || this.check('DIV')) {
            const op = this.advance().value;
            const right = this.parsePower();
            expr = { type: 'BinaryOp', left: expr, op, right };
        }

        return expr;
    }

    /**
     * Parse power (^)
     */
    parsePower() {
        let expr = this.parseUnary();

        while (this.check('POW')) {
            const op = this.advance().value;
            const right = this.parseUnary();
            expr = { type: 'BinaryOp', left: expr, op, right };
        }

        return expr;
    }

    /**
     * Parse unary (- !)
     */
    parseUnary() {
        if (this.check('MINUS') || this.check('NOT')) {
            const op = this.advance().value;
            const expr = this.parseUnary();
            return { type: 'UnaryOp', op, expr };
        }

        return this.parsePostfix();
    }

    /**
     * Parse postfix (indexing, function calls)
     */
    parsePostfix() {
        let expr = this.parsePrimary();

        while (true) {
            if (this.check('LBRACK')) {
                this.advance();
                const index = this.parseExpression();
                this.consume('RBRACK');
                expr = { type: 'IndexAccess', obj: expr, index };
            } else if (this.check('LPAREN') && expr.type === 'Identifier') {
                this.advance();
                const args = [];
                const kwargs = {};
                while (!this.check('RPAREN') && !this.isAtEnd()) {
                    // Check if this is a named argument
                    if (this.check('ID')) {
                        const savedPos = this.position;
                        const name = this.advance().value;
                        
                        if (this.check('ASSIGN')) {
                            this.advance(); // consume =
                            const value = this.parseAdditive(); // Use lower precedence to avoid consuming too much
                            kwargs[name] = value;
                        } else {
                            // Not a named argument, restore position and parse as expression
                            this.position = savedPos;
                            args.push(this.parseAdditive());
                        }
                    } else {
                        args.push(this.parseAdditive());
                    }
                    
                    if (this.check('COMMA')) {
                        this.advance();
                    } else if (!this.check('RPAREN')) {
                        break;
                    }
                }
                this.consume('RPAREN');
                expr = { type: 'FunctionCall', name: expr.name, args, kwargs };
            } else if (this.check('DOLLAR')) {
                this.advance();
                const field = this.consume('ID').value;
                expr = { type: 'DollarAccess', obj: expr, field };
            } else if (this.check('COLON')) {
                // Handle range operator
                this.advance();
                const right = this.parseMultiplicative();
                expr = { type: 'BinaryOp', left: expr, op: ':', right };
            } else {
                break;
            }
        }

        return expr;
    }

    /**
     * Parse primary (literals, identifiers, parentheses)
     */
    parsePrimary() {
        if (this.isAtEnd()) {
            throw new Error('Fim inesperado do código');
        }

        if (this.check('INT')) {
            return { type: 'IntLiteral', value: parseInt(this.advance().value) };
        }

        if (this.check('FLOAT')) {
            return { type: 'FloatLiteral', value: parseFloat(this.advance().value) };
        }

        if (this.check('STRING')) {
            return { type: 'StringLiteral', value: this.advance().value };
        }

        if (this.check('TRUE')) {
            this.advance();
            return { type: 'BoolLiteral', value: true };
        }

        if (this.check('FALSE')) {
            this.advance();
            return { type: 'BoolLiteral', value: false };
        }

        if (this.check('ID')) {
            const name = this.advance().value;
            // Check for range operator
            if (this.check('COLON')) {
                const id = { type: 'Identifier', name };
                this.advance();
                const right = this.parsePrimary();
                return { type: 'BinaryOp', left: id, op: ':', right };
            }
            return { type: 'Identifier', name };
        }

        if (this.check('LPAREN')) {
            this.advance();
            const expr = this.parseExpression();
            this.consume('RPAREN');
            return expr;
        }

        if (this.check('FUNCTION')) {
            this.advance(); // consume 'function'
            this.consume('LPAREN');
            const params = [];
            while (!this.check('RPAREN')) {
                params.push(this.consume('ID').value);
                if (this.check('COMMA')) {
                    this.advance();
                }
            }
            this.consume('RPAREN');
            const body = this.parseStatement();
            return { type: 'FunctionExpr', params, body };
        }

        if (this.check('COMMENT')) {
            const comment = this.advance().value;
            return { type: 'Comment', value: comment };
        }

        throw new Error(`Token não esperado: ${JSON.stringify(this.peek())}`);
    }

    /**
     * Code generation
     */
    generateCode(ast) {
        if (ast.type === 'Program') {
            // Collect functions used in the program
            const usedFunctions = this.collectFunctions(ast);
            const imports = this.generateImports(usedFunctions);
            
            // Analyze variable scopes to identify loops needing 'global' declarations
            this.globalLoopsMap = this.analyzeVariableScopes(ast);
            
            const lines = [];
            
            // Add imports if any
            if (imports) {
                lines.push(imports);
            }
            
            // Generate code for each statement
            ast.stmts.forEach((s, idx) => {
                const code = this.generateCode(s);
                const lastStmt = idx === ast.stmts.length - 1;
                
                // Se é a última statement
                if (lastStmt) {
                    // Se é uma expressão pura (não assignment), envolver com println
                    if (s.type === 'ExpressionStatement' && 
                        s.expr.type !== 'Assignment' &&
                        s.expr.type !== 'IndexAssignment' &&
                        s.expr.type !== 'DollarAssignment') {
                        // Última expressão que não é assignment - mostrar resultado
                        lines.push(`println(${code})`);
                    }
                    // Se é uma atribuição simples, mostrar a variável atribuída
                    else if (s.type === 'ExpressionStatement' && s.expr.type === 'Assignment') {
                        lines.push(`${code}\nprintln(${s.expr.name})`);
                    }
                    else {
                        // Qualquer outra coisa
                        lines.push(code);
                    }
                } else {
                    lines.push(code);
                }
            });
            
            return lines.filter(s => s).join('\n');
        }

        if (ast.type === 'ExpressionStatement') {
            return this.generateCode(ast.expr);
        }

        if (ast.type === 'Assignment') {
            return `${ast.name} = ${this.generateCode(ast.expr)}`;
        }

        if (ast.type === 'IndexAssignment') {
            const target = this.generateCode(ast.target);
            const index = this.generateCode(ast.index);
            const value = this.generateCode(ast.expr);
            
            return `${target}[${index}] = ${value}`;
        }

        if (ast.type === 'DollarAssignment') {
            const target = this.generateCode(ast.target);
            const field = ast.field;
            const value = this.generateCode(ast.expr);
            
            return `${target}["${field}"] = ${value}`;
        }

        if (ast.type === 'IfStatement') {
            let code = `if ${this.generateCode(ast.condition)}\n`;
            code += this.indent(this.generateCode(ast.thenBranch)) + '\n';
            if (ast.elseBranch) {
                code += `else\n`;
                code += this.indent(this.generateCode(ast.elseBranch)) + '\n';
            }
            code += `end`;
            return code;
        }

        if (ast.type === 'ForLoop') {
            let code = `for ${ast.variable} in ${this.generateCode(ast.iterable)}\n`;
            code += this.indent(this.generateCode(ast.body)) + '\n';
            code += `end`;
            return code;
        }

        if (ast.type === 'WhileLoop') {
            let code = `while ${this.generateCode(ast.condition)}\n`;
            
            const lines = [];
            
            // Check if this loop needs 'global' declarations
            if (this.globalLoopsMap.has(ast)) {
                const globalVars = this.globalLoopsMap.get(ast);
                const globalDecl = Array.from(globalVars).join(', ');
                lines.push(`global ${globalDecl}`);
            }
            
            // Add body
            const bodyCode = this.generateCode(ast.body);
            lines.push(bodyCode);
            
            // Combine and indent
            const bodyWithGlobal = lines.join('\n');
            code += this.indent(bodyWithGlobal) + '\n';
            code += `end`;
            return code;
        }

        if (ast.type === 'Block') {
            return ast.stmts.map(s => this.generateCode(s)).filter(s => s).join('\n');
        }

        if (ast.type === 'ReturnStatement') {
            if (ast.expr) {
                return `return ${this.generateCode(ast.expr)}`;
            }
            return `return`;
        }

        if (ast.type === 'FunctionDef') {
            let code = `function f(${ast.params.join(', ')})\n`;
            code += this.indent(this.generateCode(ast.body)) + '\n';
            code += `end`;
            return code;
        }

        if (ast.type === 'FunctionExpr') {
            // Anonymous function: f <- function(x) { x + 1 }
            // In Julia: f = (x) -> x + 1 (single expression)
            // or f = function(x) ... end (for blocks with multiple statements)
            
            // Check if body is a simple expression or a block
            const isSimpleExpr = ast.body.type !== 'Block' && 
                                 ast.body.type !== 'ExpressionStatement' &&
                                 ast.body.type !== 'Assignment' &&
                                 ast.body.type !== 'DollarAssignment' &&
                                 ast.body.type !== 'IndexAssignment';
            
            if (isSimpleExpr) {
                let code = `(${ast.params.join(', ')}) -> ${this.generateCode(ast.body)}`;
                return code;
            } else {
                // Multi-statement function, use function...end syntax
                let code = `function(${ast.params.join(', ')})\n`;
                code += this.indent(this.generateCode(ast.body)) + '\n';
                code += `end`;
                return code;
            }
        }

        if (ast.type === 'FunctionCall') {
            const funcName = ast.name;
            const kwargs = ast.kwargs || {};
            
            // Map R functions to Julia equivalents
            const funcMap = {
                'c': () => {
                    // c() creates a vector - handle args array directly
                    // BUT: if this will be indexed with strings, convert to Dict
                    if (ast._shouldBeDict) {
                        // Convert to Dict with auto-generated keys
                        const argsList = ast.args.map((a, i) => `"v${i+1}" => ${this.generateCode(a)}`);
                        return `Dict(${argsList.join(', ')})`;
                    } else {
                        const argsList = ast.args.map(a => this.generateCode(a));
                        return `[${argsList.join(', ')}]`;
                    }
                },
                'matrix': () => {
                    // matrix(data, nrow=n, ncol=m) -> reshape(data, nrow, ncol)
                    if (ast.args.length === 0) {
                        return `reshape([], 0, 0)`;
                    }
                    const dataArg = this.generateCode(ast.args[0]);
                    if (!kwargs['nrow'] && !kwargs['ncol']) {
                        // Sem dimensões especificadas, apenas converter para array
                        return dataArg;
                    }
                    const nrow = kwargs['nrow'] ? this.generateCode(kwargs['nrow']) : null;
                    const ncol = kwargs['ncol'] ? this.generateCode(kwargs['ncol']) : null;
                    
                    // Se nrow é especificado mas ncol não, calcular ncol = length/nrow
                    if (nrow && !ncol) {
                        return `reshape(${dataArg}, ${nrow}, div(length(${dataArg}), ${nrow}))`;
                    } else if (ncol && !nrow) {
                        return `reshape(${dataArg}, div(length(${dataArg}), ${ncol}), ${ncol})`;
                    } else if (nrow && ncol) {
                        return `reshape(${dataArg}, ${nrow}, ${ncol})`;
                    }
                    return dataArg;
                },
                'list': () => {
                    // list() -> Dict
                    const argsList = ast.args.map(a => this.generateCode(a));
                    const kwargsList = Object.entries(kwargs).map(([k,v]) => `"${k}" => ${this.generateCode(v)}`);
                    const allParts = [...argsList, ...kwargsList];
                    return `Dict(${allParts.join(', ')})`;
                },
                'data.frame': () => {
                    // data.frame() -> Dict of vectors (no DataFrames package needed)
                    const argsList = ast.args.map(a => this.generateCode(a));
                    const kwargsList = Object.entries(kwargs).map(([k,v]) => `"${k}" => ${this.generateCode(v)}`);
                    const allParts = [...argsList, ...kwargsList];
                    return `Dict(${allParts.join(', ')})`;
                },
                'is.double': () => {
                    const args = ast.args.map(a => this.generateCode(a)).join(', ');
                    return `isa(${args}, Float64)`;
                },
                'is.integer': () => {
                    const args = ast.args.map(a => this.generateCode(a)).join(', ');
                    return `isa(${args}, Int64)`;
                },
                'is.numeric': () => {
                    const args = ast.args.map(a => this.generateCode(a)).join(', ');
                    return `isa(${args}, Number)`;
                },
                'is.character': () => {
                    const args = ast.args.map(a => this.generateCode(a)).join(', ');
                    return `isa(${args}, String)`;
                },
                'is.logical': () => {
                    const args = ast.args.map(a => this.generateCode(a)).join(', ');
                    return `isa(${args}, Bool)`;
                },
                'print': () => {
                    const args = ast.args.map(a => this.generateCode(a)).join(', ');
                    return `println(${args})`;
                },
                'length': () => {
                    const args = ast.args.map(a => this.generateCode(a)).join(', ');
                    return `length(${args})`;
                },
                'mean': () => {
                    const args = ast.args.map(a => this.generateCode(a)).join(', ');
                    return `mean(${args})`;
                },
                'sum': () => {
                    const args = ast.args.map(a => this.generateCode(a)).join(', ');
                    return `sum(${args})`;
                },
                'sqrt': () => {
                    const args = ast.args.map(a => this.generateCode(a)).join(', ');
                    return `sqrt(${args})`;
                },
                'abs': () => {
                    const args = ast.args.map(a => this.generateCode(a)).join(', ');
                    return `abs(${args})`;
                },
                'exp': () => {
                    const args = ast.args.map(a => this.generateCode(a)).join(', ');
                    return `exp(${args})`;
                },
                'log': () => {
                    const args = ast.args.map(a => this.generateCode(a)).join(', ');
                    return `log(${args})`;
                },
                'min': () => {
                    const args = ast.args.map(a => this.generateCode(a)).join(', ');
                    return `minimum(${args})`;
                },
                'max': () => {
                    const args = ast.args.map(a => this.generateCode(a)).join(', ');
                    return `maximum(${args})`;
                },
                'new.env': () => {
                    // new.env() creates an environment (similar to a Dict/namespace in Julia)
                    return `Dict()`;
                },
                'paste': () => {
                    // paste() in R concatenates strings - equivalent to string() in Julia
                    const args = ast.args.map(a => this.generateCode(a)).join(', ');
                    return `string(${args})`;
                },
                'nchar': () => {
                    // nchar() returns length of string
                    const args = ast.args.map(a => this.generateCode(a)).join(', ');
                    return `length(${args})`;
                },
            };
            
            if (funcMap[funcName]) {
                return funcMap[funcName]();
            }
            
            // Default: keep function name and args
            const args = ast.args.map(a => this.generateCode(a)).join(', ');
            const kwargStrs = Object.entries(kwargs).map(([k, v]) => `${k}=${this.generateCode(v)}`).join(', ');
            const allArgs = [...(args ? [args] : []), ...kwargStrs ? [kwargStrs] : []].filter(a => a);
            return `${funcName}(${allArgs.join(', ')})`;
        }

        if (ast.type === 'BinaryOp') {
            const left = this.generateCode(ast.left);
            const right = this.generateCode(ast.right);
            if (ast.op === '^') {
                // Use broadcasting (dot notation) for power operator to work with vectors
                return `${left}.^${right}`;
            }
            if (ast.op === ':') {
                return `${left}:${right}`;
            }
            // For arithmetic operators that might involve vectors, use broadcasting
            if (['+', '-', '*', '/'].includes(ast.op)) {
                return `(${left} .${ast.op} ${right})`;
            }
            return `(${left} ${ast.op} ${right})`;
        }

        if (ast.type === 'UnaryOp') {
            return `(${ast.op}${this.generateCode(ast.expr)})`;
        }

        if (ast.type === 'IndexAccess') {
            return `${this.generateCode(ast.obj)}[${this.generateCode(ast.index)}]`;
        }

        if (ast.type === 'DollarAccess') {
            return `${this.generateCode(ast.obj)}["${ast.field}"]`;
        }

        if (ast.type === 'Identifier') {
            return ast.name;
        }

        if (ast.type === 'IntLiteral') {
            return String(ast.value);
        }

        if (ast.type === 'FloatLiteral') {
            return String(ast.value);
        }

        if (ast.type === 'StringLiteral') {
            return `"${ast.value.replace(/"/g, '\\"')}"`;
        }

        if (ast.type === 'BoolLiteral') {
            return ast.value ? 'true' : 'false';
        }

        if (ast.type === 'Comment') {
            return ast.value;
        }

        return '';
    }

    /**
     * Helper methods
     */
    peek() {
        return this.tokens[this.position] || { type: 'EOF' };
    }

    peekAhead(offset) {
        return this.tokens[this.position + offset] || { type: 'EOF' };
    }

    check(type) {
        return this.peek().type === type;
    }

    advance() {
        return this.tokens[this.position++];
    }

    consume(type) {
        if (!this.check(type)) {
            const current = this.peek();
            throw new Error(`Esperado ${type}, mas obteve ${current.type}. Contexto: ${current.value || ''}`);
        }
        return this.advance();
    }

    isAtEnd() {
        return this.peek().type === 'EOF';
    }

    indent(code) {
        return code.split('\n').map(line => '    ' + line).join('\n');
    }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RtoJuliaTranspiler;
}
