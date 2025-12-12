import ply.lex as lex

# Palavras reservadas (keywords)
reserved = {
    'if': 'IF',
    'else': 'ELSE',
    'for': 'FOR',
    'in': 'IN',
    'while': 'WHILE',
    'function': 'FUNCTION',
    'return': 'RETURN',
    # TRUE/FALSE tratados no t_ID
}

# Tokens
tokens = (
    'ID', 'INT_LITERAL', 'FLOAT_LITERAL', 'STRING_LITERAL', 'BOOL_LITERAL',
    'PLUS', 'MINUS', 'MUL', 'DIV', 'POW',
    'EQ', 'NE', 'LT', 'LE', 'GT', 'GE',
    'ASSIGN_ARROW', 'ASSIGN_EQ',
    'LPAREN', 'RPAREN', 'LBRACE', 'RBRACE', 'LBRACK', 'RBRACK', 'COMMA', 'SEMICOLON', 'COLON',
    'AND', 'OR', 'NOT',
    'NEWLINE',
    'DOLLAR', 'BACKTICK'
) + tuple(reserved.values())

# Arithmetic operators
t_PLUS = r'\+'
t_MINUS = r'-'
t_MUL = r'\*'
t_DIV = r'/'
t_POW = r'\^'

# Assignments (mais longo primeiro)
t_ASSIGN_ARROW = r'<-'
t_ASSIGN_EQ = r'='

# Comparators
t_EQ = r'=='
t_NE = r'!='
t_LE = r'<='
t_GE = r'>='
t_LT = r'<'
t_GT = r'>'

# Punctuation
t_LPAREN = r'\('
t_RPAREN = r'\)'
t_LBRACE = r'\{'
t_RBRACE = r'\}'
t_LBRACK = r'\['
t_RBRACK = r'\]'
t_COMMA = r','
t_SEMICOLON = r';'
t_COLON = r':'
t_DOLLAR = r'\$' 
t_BACKTICK = r'`'

# Logical operators
t_AND = r'\&\&'
t_OR = r'\|\|'
t_NOT = r'!'

# Ignore spaces and tabs (não newline)
t_ignore = ' \t\r'

# FLOAT primeiro (1.23, 1.23e-4 etc.)
def t_FLOAT_LITERAL(t):
    r'\d+\.\d+([eE][+-]?\d+)?'
    t.value = float(t.value)
    return t

def t_CR_ID(t):
    r'`[^`]+`'
    t.value = t.value  # mantém o literal com crase ou remove crases se quiser
    t.type = 'ID'
    return t

# INT com sufixo opcional L (42 ou 42L)
def t_INT_LITERAL(t):
    r'\d+L?'
    s = t.value
    if s.endswith(('L','l')):
        s = s[:-1]
    t.value = int(s)
    return t

# STRING
def t_STRING_LITERAL(t):
    r'"([^"\\]|\\.)*"|\'([^\'\\]|\\.)*\''
    t.value = t.value[1:-1]
    return t

# ID (permite pontos dentro do nome)
def t_ID(t):
    r'[A-Za-z_][A-Za-z0-9_\.]*'  # pontos permitidos
    vl = t.value.upper()
    if vl == "TRUE" or vl == "FALSE":
        t.type = 'BOOL_LITERAL'
        t.value = (vl == "TRUE")
    elif t.value in reserved:
        t.type = reserved[t.value]
    return t

# NEWLINE
def t_NEWLINE(t):
    r'\n+'
    t.lexer.lineno += len(t.value)
    return t

# Comentários
def t_COMMENT(t):
    r'\#.*'
    pass

# Erro
def t_error(t):
    print(f"Illegal character '{t.value[0]}' at line {t.lexer.lineno}")
    t.lexer.skip(1)

def t_ANY_error(t):
    print(f"Illegal character '{t.value[0]}' at line {t.lexer.lineno}")
    t.lexer.skip(1)

lexer = lex.lex()

# Debug: imprime tokens
if __name__ == "__main__":
    lexer.input("is.double(3.14)")
    while True:
        tok = lexer.token()
        if not tok:
            break
        print(tok)
