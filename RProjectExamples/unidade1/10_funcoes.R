# Exemplos de subprogramas (funções) em R

# Função simples
soma <- function(a, b) {
  return(a + b)
}
print(soma(5, 3))

# Função anônima (lambda)
quadrado <- function(x) x^2
print(quadrado(4))

# Função com múltiplas operações
calcular <- function(x, y) {
  result <- x * y + 10
  return(result)
}
print(calcular(3, 4))

# Função que retorna um vetor
criar_vetor <- function(n) {
  v <- c(1, 2, 3, 4, 5)
  return(v)
}
print(criar_vetor(5))
