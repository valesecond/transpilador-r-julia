from .ast_nodes import *

class JuliaCodeGen:
    def __init__(self):
        self.indent_level = 0
        # guarda nomes de structs (capitalizados) já emitidos para evitar duplicação
        self._created_structs = set()


    # ------------------- HELPERS -------------------
    def is_number(self, s):
        try:
            float(s)
            return True
        except:
            return False

    # ------------------- TYPE CHECKS -------------------
    def gen_IsDouble(self, node):
        return f"{self.generate(node.expr)} isa Float64"

    def gen_IsInteger(self, node):
        return f"{self.generate(node.expr)} isa Int"

    # ------------------- ASSIGNMENT -------------------
    def gen_Assign(self, node):
        expr_code = self.generate(node.expr)

        # Detecta criação de S3 object: structure(..., class="myclass")
        if isinstance(node.expr, Call) and node.expr.name == "structure":
            # Pega o nome da classe (valor da NamedArg class)
            class_name = next(
                (kw.value.value for kw in node.expr.args if isinstance(kw, NamedArg) and kw.name == "class"),
                None
            )
            if class_name:
                value_expr = self.generate(node.expr.args[0]) if node.expr.args else "nothing"
                class_name_cap = class_name.capitalize()

                # Cria o struct apenas uma vez
                struct_code = ""
                if class_name_cap not in self._created_structs:
                    struct_code = f"struct {class_name_cap}\n    value\nend"
                    self._created_structs.add(class_name_cap)

                assign_code = f"{node.name} = {class_name_cap}({value_expr})"
                if struct_code:
                    return f"{struct_code}\n{assign_code}"
                return assign_code

        # Fallback normal
        return f"{node.name} = {expr_code}"

    def gen_S3FunctionDecl(self, node):
        """
        Exemplo: `+.myclass` <- function(a, b) ...
        Gera corretamente em Julia:
            import Base: +
            +(a::Myclass, b::Myclass) = ...
        """
        # Remove crases e separa operador e classe
        op_name, class_name = node.operator_name.strip("`").split(".")
        class_name_cap = class_name.capitalize()

        # Corpo da função
        body_code = self.generate(node.body)

        # Gera import e função corretamente
        func_def = f"import Base: {op_name}\n{op_name}(a::{class_name_cap}, b::{class_name_cap}) = {body_code}"

        return func_def

    def gen_AssignIndex(self, node):
        target = self.generate(node.target)
        index = self.generate(node.index)
        value = self.generate(node.expr)

        # Somente converter se for array (não env, não DataFrame)
        if index.startswith('"') and index.endswith('"') and target.startswith("v"):
            return (
                f"{target} = Dict(string(i) => {target}[i] for i in eachindex({target}))\n"
                f"{target}[{index}] = {value}"
            )

        return f"{target}[{index}] = {value}"

    # ------------------- ACCESS -------------------
    def gen_DollarAccess(self, node):
        target = self.generate(node.target)
        field = node.field
        return f'{target}["{field}"]'

    def gen_IndexOp(self, node):
        return f"{self.generate(node.target)}[{self.generate(node.index)}]"

    # ------------------- PROGRAM / BLOCK -------------------
    def indent(self):
        return "    " * self.indent_level

    def gen_Program(self, node):
        lines = []
        for s in node.stmts:
            out = self.generate(s)
            if out:
                lines.append(out)
        return "\n".join(lines)

    def gen_Block(self, node):
        lines = []
        self.indent_level += 1
        for s in node.stmts:
            out = self.generate(s)
            if out:
                lines.append(self.indent() + out)
        self.indent_level -= 1
        return "\n".join(lines)

    def gen_ExprStmt(self, node):
        return self.generate(node.expr)

    # ------------------- LITERALS -------------------
    def gen_IntLiteral(self, node):
        return str(node.value)

    def gen_FloatLiteral(self, node):
        return str(node.value)

    def gen_StringLiteral(self, node):
        text = node.value.replace('"', '\\"')
        return f"\"{text}\""

    def gen_BoolLiteral(self, node):
        return "true" if node.value else "false"

    # ------------------- VARIABLES / OPS -------------------
    def gen_Var(self, node):
        return node.name

    def gen_UnaryOp(self, node):
        if node.op == "!":
            return f"(!{self.generate(node.expr)})"
        if node.op == "-":
            return f"(-{self.generate(node.expr)})"
        return f"{node.op}{self.generate(node.expr)}"

    def gen_BinaryOp(self, node):
        op = node.op
        if op in ("&", "&&"):
            op = "&&"
        if op in ("|", "||"):
            op = "||"
        if op == ":":
            return f"{self.generate(node.left)}:{self.generate(node.right)}"
        return f"({self.generate(node.left)} {op} {self.generate(node.right)})"

    # ------------------- CALLS -------------------
    def gen_Call(self, node):
        pos = []
        kws = []

        for a in node.args:
            if isinstance(a, NamedArg):
                kws.append((a.name, self.generate(a.value)))
            else:
                pos.append(self.generate(a))

        name = node.name

        # Detecção do caso "exists(x)" e conversão para "isdefined(Main, :x)"
        if name == "exists":
            arg = pos[0] if pos else ""
            return f"isdefined(Main, Symbol({arg}))"


        # Caso para print(x) → println(x)
        if name == "print":
            arg = pos[0] if pos else ""
            return f"println({arg})"

        # Caso para c(...) → vetor numérico
        if name == "c":
            return f"[{', '.join(pos)}]"

        # Caso para matrix(data, nrow=?, ncol=?) → reshape(data, nrow, div(length(data), nrow))
        if name == "matrix":
            data = pos[0] if pos else "[]"
            nrow = next((v for k, v in kws if k == "nrow"), None)
            if nrow:
                return f"reshape({data}, {nrow}, div(length({data}), {nrow}))"
            return f"reshape({data}, :, :)"

        # Caso para list(...) → Dict
        if name == "list":
            items = [f"\"{k}\" => {v}" for k, v in kws]
            return f"Dict({', '.join(items)})"

        # Caso para data.frame(...) → DataFrame(...)
        if name == "data.frame":
            args = [f"{k} = {v}" for k, v in kws]
            return f"DataFrame({', '.join(args)})"

        # fallback: retorna chamada Julia genérica
        args = ", ".join(pos + [f"{k} = {v}" for k, v in kws])
        return f"{name}({args})"


    def gen_Var(self, node):
        name = node.name
        if name.startswith("`") and name.endswith("`"):
            return name  # mantém as crases
        return name

    # ------------------- CONTROL FLOW -------------------
    def gen_If(self, node):
        # Detecta else if (else cujo bloco é um único If)
        if node.else_block and len(node.else_block.stmts) == 1 and isinstance(node.else_block.stmts[0], If):
            inner_if = node.else_block.stmts[0]
            return "\n".join([
                f"if {self.generate(node.cond)}",
                self.gen_Block(node.then_block),
                f"elseif {self.generate(inner_if.cond)}",
                self.gen_Block(inner_if.then_block),
                "else",
                self.gen_Block(inner_if.else_block),
                "end"
            ])

        # if normal
        out = [
            f"if {self.generate(node.cond)}",
            self.gen_Block(node.then_block)
        ]

        if node.else_block:
            out += ["else", self.gen_Block(node.else_block)]

        out.append("end")
        return "\n".join(out)

    def _assigned_vars(self, block):
        """
        Retorna um set com os nomes das variáveis atribuídas no bloco.
        """
        vars_ = set()

        for stmt in block.stmts:
            if isinstance(stmt, Assign):
                vars_.add(stmt.name)

            if isinstance(stmt, If):
                vars_ |= self._assigned_vars(stmt.then_block)
                if stmt.else_block:
                    vars_ |= self._assigned_vars(stmt.else_block)

            if isinstance(stmt, While):
                vars_ |= self._assigned_vars(stmt.body)

            if isinstance(stmt, For):
                vars_ |= self._assigned_vars(stmt.body)

        return vars_


    def gen_While(self, node):
        cond = self.generate(node.cond)

        assigned = self._assigned_vars(node.body)

        if hasattr(node.cond, "left") and hasattr(node.cond.left, "name"):
            assigned.add(node.cond.left.name)

        # aumenta indentação para o corpo do while
        self.indent_level += 1
        body = self.gen_Block(node.body)
        self.indent_level -= 1

        if assigned:
            lets = ", ".join(f"{v} = {v}" for v in sorted(assigned))
            return "\n".join([
                f"let {lets}",
                f"    while {cond}",
                body,
                f"    end",
                "end"
            ])

        return "\n".join([
            f"while {cond}",
            body,
            "end"
        ])

    def _body_assigns_var(self, block):
        """
        Retorna True se o corpo do while contém alguma atribuição (x = ...)
        Isso indica mutação e exige escopo (let) em Julia.
        """
        for stmt in block.stmts:
            # atribuição direta: x <- ...
            if isinstance(stmt, Assign):
                return True

            # if dentro do while
            if isinstance(stmt, If):
                if self._body_assigns_var(stmt.then_block):
                    return True
                if stmt.else_block and self._body_assigns_var(stmt.else_block):
                    return True

            # while aninhado
            if isinstance(stmt, While):
                if self._body_assigns_var(stmt.body):
                    return True

            # for aninhado
            if isinstance(stmt, For):
                if self._body_assigns_var(stmt.body):
                    return True

        return False


    def gen_For(self, node):
        if node.start_expr is not None:
            start = self.generate(node.start_expr)
            end = self.generate(node.end_expr)
            header = f"for {node.var} in {start}:{end}"
        else:
            header = f"for {node.var} in {self.generate(node.end_expr)}"
        return "\n".join([header, self.gen_Block(node.body), "end"])

    def gen_FunctionDecl(self, node):
        # node.name pode estar com crases: '`+.myclass`' ou sem crases dependendo do lexer
        name_raw = node.name
        name_stripped = name_raw.strip("`") if isinstance(name_raw, str) else name_raw

        # Se o nome tem o formato operador.classe (ex: +.myclass), trata como S3 operator
        if isinstance(name_stripped, str) and "." in name_stripped:
            op, cls = name_stripped.split(".", 1)
            # heurística: op deve ser um operador válido (um ou poucos caracteres)
            # aceitaremos qualquer op curto; você pode ajustar a lista se quiser.
            if len(op) <= 3:
                cls_cap = cls.capitalize()

                # garante que o struct exista (evita duplicações)
                struct_code = ""
                if cls_cap not in self._created_structs:
                    struct_code = f"struct {cls_cap}\n    value\nend"
                    self._created_structs.add(cls_cap)

                # gera o corpo da função
                body_code = self.generate(node.body)

                # se body_code for multi-linha, usamos begin/end
                if "\n" in body_code:
                    func_code = f"import Base: {op}\n{op}(a::{cls_cap}, b::{cls_cap}) = begin\n{body_code}\nend"
                else:
                    func_code = f"import Base: {op}\n{op}(a::{cls_cap}, b::{cls_cap}) = {body_code}"

                # se precisamos emitir struct, colocamos antes da função
                if struct_code:
                    return f"{struct_code}\n{func_code}"
                return func_code

        # fallback: geração normal de função (mantém comportamento existente)
        params = ", ".join(node.params)
        return "\n".join([f"function {node.name}({params})",
                        self.gen_Block(node.body),
                        "end"])


    def gen_Return(self, node):
        return f"return {self.generate(node.expr)}"

    # ------------------- DISPATCH -------------------
    def generate(self, node):
        if node is None:
            return None
        method = "gen_" + node.__class__.__name__
        if not hasattr(self, method):
            raise NotImplementedError(f"No codegen for {node.__class__.__name__}")
        return getattr(self, method)(node)
