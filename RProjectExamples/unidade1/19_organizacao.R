# Separe código em funções, evite scripts muito longos
# Facilita manutenção e reutilização

# Função modular para calcular dobro
calcular_dobro <- function(vetor) {
  return(vetor * 2)
}

# Função modular para calcular triplo
calcular_triplo <- function(vetor) {
  return(vetor * 3)
}

# Função modular para calcular soma
calcular_soma <- function(a, b) {
  return(a + b)
}

# Dados de entrada
valores <- c(1, 2, 3)
numero1 <- 10
numero2 <- 20

# Usar as funções
resultado_dobro <- calcular_dobro(valores)
print(resultado_dobro)

resultado_triplo <- calcular_triplo(valores)
print(resultado_triplo)

resultado_soma <- calcular_soma(numero1, numero2)
print(resultado_soma)

# Combinar funções
dobrados <- calcular_dobro(valores)
triplicados <- calcular_triplo(valores)
soma_final <- calcular_soma(sum(dobrados), sum(triplicados))
print(soma_final)
