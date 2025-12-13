# Exemplo de operações em vetores em R

# Função simples para aplicar
calculo <- function(x) {
  return(x^2)
}

# Aplicar função a um vetor
valores <- c(1, 2, 3, 4)
resultado <- c(calculo(1), calculo(2), calculo(3), calculo(4))
print(resultado)

# Função com múltiplas operações
processar <- function(x) {
  dobro <- x * 2
  quadrado <- x^2
  soma <- dobro + quadrado
  return(soma)
}

valores2 <- c(1, 2, 3)
resultado2 <- c(processar(1), processar(2), processar(3))
print(resultado2)

# Vetor com operações aritméticas
v <- c(1, 2, 3, 4, 5)
dobrados <- v * 2
print(dobrados)
