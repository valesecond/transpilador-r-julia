import ply.yacc as yacc
from .lexer import tokens, lexer
from .ast_nodes import *


precedence = (
    ('right', 'ASSIGN_ARROW', 'ASSIGN_EQ'),
    ('left', 'OR'),
    ('left', 'AND'),
    ('right', 'NOT'),
    ('nonassoc', 'EQ','NE','LT','LE','GT','GE'),
    ('left', 'PLUS','MINUS'),
    ('left', 'MUL','DIV'),
    ('right', 'POW'),
    ('left', 'DOLLAR'),
)

# Program
def p_program(p):
    'program : statements'
    p[0] = Program(p[1])


# Statements
def p_statements_single(p):
    'statements : statement'
    if p[1] is None:
        p[0] = []
    else:
        p[0] = [p[1]]


def p_statements_multiple(p):
    '''statements : statements statement
                  | statements SEMICOLON statement
                  | statements NEWLINE statement'''
    if len(p) == 3:
        new_stmt = p[2]
    else:
        new_stmt = p[3]
    if new_stmt is None:
        p[0] = p[1]
    else:
        p[0] = p[1] + [new_stmt]


# Assignment (statement only)
def p_statement_assignment(p):
    '''statement : ID ASSIGN_ARROW expression
                 | ID ASSIGN_EQ expression'''
    name = str(p[1])
    p[0] = Assign(name, p[3])

def p_statement_assignment_index(p):
    'statement : expression LBRACK expression RBRACK ASSIGN_ARROW expression'
    p[0] = AssignIndex(p[1], p[3], p[6])


# Expression as statement
def p_statement_expr(p):
    'statement : expression'
    p[0] = ExprStmt(p[1])


# Empty statements
def p_statement_semicolon_only(p):
    'statement : SEMICOLON'
    p[0] = None


def p_statement_newline_only(p):
    'statement : NEWLINE'
    p[0] = None


# Binary operators
def p_expression_binop(p):
    '''expression : expression PLUS expression
                  | expression MINUS expression
                  | expression MUL expression
                  | expression DIV expression
                  | expression POW expression
                  | expression EQ expression
                  | expression NE expression
                  | expression LT expression
                  | expression LE expression
                  | expression GT expression
                  | expression GE expression
                  | expression AND expression
                  | expression OR expression
                  | expression COLON expression'''
    p[0] = BinaryOp(p[2], p[1], p[3])


# Unary operators
def p_expression_unary(p):
    '''expression : NOT expression
                  | MINUS expression %prec NOT'''
    p[0] = UnaryOp(p[1], p[2])


# Parentheses
def p_expression_group(p):
    'expression : LPAREN expression RPAREN'
    p[0] = p[2]


# Literals
def p_expression_number(p):
    '''expression : INT_LITERAL
                  | FLOAT_LITERAL'''
    if isinstance(p[1], int):
        p[0] = IntLiteral(p[1])
    else:
        p[0] = FloatLiteral(p[1])


def p_expression_string(p):
    'expression : STRING_LITERAL'
    p[0] = StringLiteral(p[1])


def p_expression_bool(p):
    'expression : BOOL_LITERAL'
    p[0] = BoolLiteral(p[1])


# Variables
def p_expression_var(p):
    'expression : ID'
    name = p[1].value if hasattr(p[1], 'value') else p[1]
    p[0] = Var(name)

# Depois (ID LPAREN ... para capturar "is.double" ou "is.integer"):
def p_expression_is_check(p):
    'expression : ID LPAREN expression RPAREN'
    if p[1] == 'is.double':
        p[0] = IsDouble(p[3])
    elif p[1] == 'is.integer':
        p[0] = IsInteger(p[3])
    else:
        p[0] = Call(p[1], [p[3]])


# Function calls
def p_expression_call_noargs(p):
    'expression : ID LPAREN RPAREN'
    name = p[1].value if hasattr(p[1], 'value') else p[1]
    p[0] = Call(name, [])


def p_expression_call(p):
    'expression : ID LPAREN arg_list RPAREN'
    name = str(p[1])
    p[0] = Call(name, p[3])


def p_arg_list_multiple(p):
    'arg_list : arg_list COMMA arg'
    p[0] = p[1] + [p[3]]


def p_arg_list_single(p):
    'arg_list : arg'
    p[0] = [p[1]]


def p_arg_named(p):
    'arg : ID ASSIGN_EQ expression'
    name = str(p[1])
    p[0] = NamedArg(name, p[3])


def p_arg_positional(p):
    'arg : expression'
    p[0] = p[1]


# If / else
def p_statement_if(p):
    '''statement : IF LPAREN expression RPAREN block
                 | IF LPAREN expression RPAREN block ELSE block'''
    if len(p) == 6:
        p[0] = If(p[3], p[5], None)
    else:
        p[0] = If(p[3], p[5], p[7])


# Block
def p_block_braces(p):
    'block : LBRACE statements RBRACE'
    p[0] = Block(p[2])


def p_block_statement(p):
    'block : statement'
    p[0] = Block([p[1]])


# While
def p_statement_while(p):
    'statement : WHILE LPAREN expression RPAREN block'
    p[0] = While(p[3], p[5])


# For
def p_statement_for(p):
    'statement : FOR LPAREN ID IN expression RPAREN block'
    var_name = p[3].value if hasattr(p[3], 'value') else p[3]
    rng = p[5]
    if isinstance(rng, BinaryOp) and rng.op == ':':
        start = rng.left
        end = rng.right
    else:
        start = None
        end = rng
    p[0] = For(var_name, start, end, p[7])


# Function declaration
def p_statement_function_decl(p):
    'statement : ID ASSIGN_ARROW FUNCTION LPAREN param_list RPAREN block'
    name = p[1].value if hasattr(p[1], 'value') else p[1]
    p[0] = FunctionDecl(name, p[5], p[8])


def p_statement_function_decl_no_params(p):
    'statement : ID ASSIGN_ARROW FUNCTION LPAREN RPAREN block'
    name = p[1].value if hasattr(p[1], 'value') else p[1]
    p[0] = FunctionDecl(name, [], p[7])


def p_param_list_multiple(p):
    'param_list : param_list COMMA ID'
    p[0] = p[1] + [p[3].value if hasattr(p[3], 'value') else p[3]]


def p_param_list_single(p):
    'param_list : ID'
    p[0] = [p[1].value if hasattr(p[1], 'value') else p[1]]


# Indexing
def p_expression_index(p):
    'expression : expression LBRACK expression RBRACK'
    p[0] = IndexOp(p[1], p[3])


# Return
def p_statement_return(p):
    'statement : RETURN expression'
    p[0] = Return(p[2])


# Error
def p_error(p):
    if p:
        raise SyntaxError(f"Syntax error at token {p.type} ({p.value!r}) line {getattr(p, 'lineno','unknown')}")
    else:
        raise SyntaxError("Syntax error at EOF")


parser = yacc.yacc()
