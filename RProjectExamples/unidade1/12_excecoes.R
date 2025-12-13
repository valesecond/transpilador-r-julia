# Tratamento de exceções em R

# Função que pode gerar erro
divisao <- function(a, b) {
  if (b == 0) {
    print("Erro: divisão por zero")
    return(NA)
  }
  return(a / b)
}

# Testando a função
resultado1 <- divisao(10, 2)
print(resultado1)

resultado2 <- divisao(5, 0)
print(resultado2)

# Função com validação
potencia <- function(base, exp) {
  if (exp < 0) {
    print("Aviso: expoente negativo")
    return(NA)
  }
  return(base ^ exp)
}

resultado3 <- potencia(2, 3)
print(resultado3)

resultado4 <- potencia(2, -1)
print(resultado4)
