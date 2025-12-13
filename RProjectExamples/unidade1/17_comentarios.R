# Comentários explicam o que o código faz
# Use comentários para explicar intenção, não cada linha trivial

# Bom comentário - Calcula a média de um vetor de notas
notas <- c(7, 8, 9, 5)
media <- mean(notas)
print(media)

# Função com comentários descritivos
# Determina se um número é positivo, negativo ou zero
classificar_numero <- function(n) {
  if (n > 0) {
    return("Positivo")
  } else if (n < 0) {
    return("Negativo")
  } else {
    return("Zero")
  }
}

# Testa a função com diferentes valores
print(classificar_numero(10))
print(classificar_numero(-5))
print(classificar_numero(0))

# Exemplo de comentário descritivo para bloco de código
# Processa um vetor de temperaturas em Celsius
# e converte para Fahrenheit
celsius <- c(0, 10, 20, 30)
fahrenheit <- celsius * 9 / 5 + 32
print(fahrenheit)
