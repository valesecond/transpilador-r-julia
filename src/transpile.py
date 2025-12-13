import sys
import os
from .lexer import lexer
from .parser import parser
from .codegen import JuliaCodeGen

def transpile(source_code):
    lexer.input(source_code)
    ast = parser.parse(source_code, lexer=lexer)
    gen = JuliaCodeGen()
    return gen.generate(ast)

def main():
    # pasta onde estão os exemplos R
    r_dir = "RProjectExamples"

    if not os.path.isdir(r_dir):
        print(f"Pasta '{r_dir}' não encontrada.")
        sys.exit(1)

    # listar arquivos .R
    r_files = sorted(
        f for f in os.listdir(r_dir)
        if f.lower().endswith(".r")
    )

    if not r_files:
        print("Nenhum arquivo .R encontrado.")
        sys.exit(1)

    print("\nArquivos R encontrados:\n")
    for i, f in enumerate(r_files, start=1):
        print(f"[{i}] {f}")

    try:
        choice = int(input("\nEscolha um arquivo para transpilar: "))
        if choice < 1 or choice > len(r_files):
            raise ValueError
    except ValueError:
        print("Escolha inválida.")
        sys.exit(1)

    infile = os.path.join(r_dir, r_files[choice - 1])

    # criar pasta juliaExamples
    os.makedirs("juliaExamples", exist_ok=True)

    base_name = os.path.splitext(os.path.basename(infile))[0]
    outfile = f"juliaExamples/{base_name}.jl"

    with open(infile, 'r', encoding='utf-8') as f:
        src = f.read()

    jc = transpile(src)

    with open(outfile, 'w', encoding='utf-8') as f:
        f.write(jc)

    print(f"\nTranspilação concluída! Código Julia salvo em: {outfile}")

    if len(sys.argv) < 2:
        print('Usage: python src/transpile.py path/to/file.R [output.jl]')
        sys.exit(1)
    
    infile = sys.argv[1]
    # criar pasta juliaExamples
    os.makedirs("juliaExamples", exist_ok=True)
    
    # definir outfile padrão
    base_name = os.path.splitext(os.path.basename(infile))[0]
    outfile = sys.argv[2] if len(sys.argv) > 2 else f"juliaExamples/{base_name}.jl"
    
    with open(infile, 'r', encoding='utf-8') as f:
        src = f.read()
    
    jc = transpile(src)
    
    with open(outfile, 'w', encoding='utf-8') as f:
        f.write(jc)
    
    print(f'Transpilação concluída! Código Julia salvo em: {outfile}')

if __name__ == '__main__':
    main()
