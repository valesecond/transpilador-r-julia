# Use nomes claros, significativos e consistentes

# Nomes ruins
x <- c(1, 2, 3)
y <- x * 2
print(y)

# Nomes bons
valores_iniciais <- c(1, 2, 3)
valores_dobrados <- valores_iniciais * 2
print(valores_dobrados)

# Função com nomes descritivos de variáveis
calcular_desconto <- function(preco_original, percentual_desconto) {
  valor_desconto <- preco_original * percentual_desconto / 100
  preco_final <- preco_original - valor_desconto
  return(preco_final)
}

preco_produto <- 100
desconto_percentual <- 10
preco_com_desconto <- calcular_desconto(preco_produto, desconto_percentual)
print(preco_com_desconto)

# Vetores com nomes significativos
notas_alunos <- c(8.5, 9.0, 7.5, 8.0)
media_da_turma <- mean(notas_alunos)
print(media_da_turma)
