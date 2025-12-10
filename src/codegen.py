from .ast_nodes import *

class JuliaCodeGen:
    def __init__(self):
        self.indent_level = 0

    def gen_IsDouble(self, node):
        return f"{self.generate(node.expr)} isa Float64"

    def gen_IsInteger(self, node):
        return f"{self.generate(node.expr)} isa Int"

    def gen_Assign(self, node):
        return f"{node.name} = {self.generate(node.expr)}"

    def gen_AssignIndex(self, node):
        target = self.generate(node.target)
        index = self.generate(node.index)
        value = self.generate(node.expr)
        # se index for string literal, cria um Dict
        if isinstance(node.index, StringLiteral):
            return f"{target} = Dict(); {target}[{index}] = {value}"
        return f"{target}[{index}] = {value}"



    def gen_IndexOp(self, node):
        return f"{self.generate(node.target)}[{self.generate(node.index)}]"

    # ======= BLOCK / INDENT =======
    def indent(self):
        return "    " * self.indent_level

    def gen_Program(self, node):
        lines = []
        for s in node.stmts:
            out = self.generate(s)
            if out is not None and out != "":
                lines.append(out)
        return "\n".join(lines)

    def gen_Block(self, node):
        lines = []
        self.indent_level += 1
        for s in node.stmts:
            out = self.generate(s)
            if out is not None and out != "":
                lines.append(self.indent() + out)
        self.indent_level -= 1
        return "\n".join(lines)

    def gen_ExprStmt(self, node):
        return self.generate(node.expr)

    # ======= LITERALS =======
    def gen_IntLiteral(self, node):
        return str(node.value)

    def gen_FloatLiteral(self, node):
        return str(node.value)

    def gen_StringLiteral(self, node):
        text = node.value.replace('"', '\\"')
        return f"\"{text}\""

    def gen_BoolLiteral(self, node):
        return "true" if node.value else "false"

    # ======= VARIABLES / OPERATORS =======
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

    # ======= FUNCTION CALLS =======
    def gen_Call(self, node):
        pos = []
        kws = []
        for a in node.args:
            if isinstance(a, NamedArg):
                kws.append((a.name, self.generate(a.value)))
            else:
                pos.append(self.generate(a))

        name = node.name

        if name == "c":
            return f"[{', '.join(pos)}]"

        if name == "list":
            items = [f"\"{k}\" => {v}" for k, v in kws]
            for i, p in enumerate(pos, start=1):
                items.append(f"\"{i}\" => {p}")
            return f"Dict({', '.join(items)})"

        if name == "matrix":
            data_expr = pos[0] if pos else None
            nrow = None
            for k, v in kws:
                if k == "nrow":
                    nrow = v
                if k == "data" and data_expr is None:
                    data_expr = v
            if data_expr is not None and nrow:
                return f"reshape({data_expr}, {nrow}, div(length({data_expr}), {nrow}))"
            return f"matrix({', '.join(pos + [f'{k}={v}' for k,v in kws])})"

        if name.startswith("data.frame"):
            args_str = [f"{k} = {v}" for k, v in kws] + pos
            return f"DataFrame({', '.join(args_str)})"

        if kws:
            pos_str = ", ".join(pos) if pos else ""
            kw_str = ", ".join(f"{k}={v}" for k, v in kws)
            return f"{name}({pos_str}; {kw_str})" if pos_str else f"{name}(; {kw_str})"
        else:
            return f"{name}({', '.join(pos)})"

    # ======= CONTROL FLOW =======
    def gen_If(self, node):
        out = [f"if {self.generate(node.cond)}",
               self.gen_Block(node.then_block)]
        if node.else_block:
            out += ["else", self.gen_Block(node.else_block)]
        out.append("end")
        return "\n".join(out)

    def gen_While(self, node):
        return "\n".join([f"while {self.generate(node.cond)}",
                          self.gen_Block(node.body),
                          "end"])

    def gen_For(self, node):
        if node.start_expr is not None:
            start = self.generate(node.start_expr)
            end = self.generate(node.end_expr)
            header = f"for {node.var} in {start}:{end}"
        else:
            header = f"for {node.var} in {self.generate(node.end_expr)}"
        return "\n".join([header, self.gen_Block(node.body), "end"])

    def gen_FunctionDecl(self, node):
        params = ", ".join(node.params)
        return "\n".join([f"function {node.name}({params})",
                          self.gen_Block(node.body),
                          "end"])

    def gen_Return(self, node):
        return f"return {self.generate(node.expr)}"

    # ======= GENERATE DISPATCH =======
    def generate(self, node):
        if node is None:
            return None
        method = "gen_" + node.__class__.__name__
        if not hasattr(self, method):
            raise NotImplementedError(f"No codegen for {node.__class__.__name__}")
        return getattr(self, method)(node)
