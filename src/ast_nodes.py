class Node:
    pass

class IsDouble(Node):
    def __init__(self, expr):
        self.expr = expr

class IsInteger(Node):
    def __init__(self, expr):
        self.expr = expr


class Program(Node):
    def __init__(self, stmts):
        self.stmts = stmts

class Block(Node):
    def __init__(self, stmts):
        self.stmts = stmts

class Assign(Node):
    def __init__(self, name, expr):
        self.name = name
        self.expr = expr

class ExprStmt(Node):
    def __init__(self, expr):
        self.expr = expr

class If(Node):
    def __init__(self, cond, then_block, else_block=None):
        self.cond = cond
        self.then_block = then_block
        self.else_block = else_block

class For(Node):
    def __init__(self, var, start_expr, end_expr, body):
        self.var = var
        self.start_expr = start_expr
        self.end_expr = end_expr
        self.body = body

class While(Node):
    def __init__(self, cond, body):
        self.cond = cond
        self.body = body

class FunctionDecl(Node):
    def __init__(self, name, params, body):
        self.name = name
        self.params = params
        self.body = body

class Return(Node):
    def __init__(self, expr):
        self.expr = expr

class Call(Node):
    def __init__(self, name, args):
        # args: list of Expr or NamedArg
        self.name = name
        self.args = args

class NamedArg(Node):
    def __init__(self, name, value):
        self.name = name
        self.value = value

class BinaryOp(Node):
    def __init__(self, op, left, right):
        self.op = op
        self.left = left
        self.right = right

class UnaryOp(Node):
    def __init__(self, op, expr):
        self.op = op
        self.expr = expr

class Var(Node):
    def __init__(self, name):
        self.name = name

class IntLiteral(Node):
    def __init__(self, value):
        self.value = value

class FloatLiteral(Node):
    def __init__(self, value):
        self.value = value

class StringLiteral(Node):
    def __init__(self, value):
        self.value = value

class BoolLiteral(Node):
    def __init__(self, value):
        self.value = value

class IndexOp(Node):
    def __init__(self, target, index):
        self.target = target
        self.index = index

class AssignIndex(Node):
    def __init__(self, target, index, expr):
        self.target = target
        self.index = index
        self.expr = expr

