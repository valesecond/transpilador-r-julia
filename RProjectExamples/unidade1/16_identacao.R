# Identação adequada melhora leitura e manutenção

# Código mal identado
for (i in 1:3) {
  print(i)
}

# Código bem identado
for (i in 1:5) {
  if (i > 2) {
    print(i)
  }
}

# Função com identação adequada
processar_dados <- function(valores) {
  resultado <- c()
  for (v in valores) {
    if (v > 0) {
      resultado <- c(resultado, v * 2)
    }
  }
  return(resultado)
}

dados <- c(1, 2, 3, 4, 5)
saida <- processar_dados(dados)
print(saida)
