# Legibilidade: escrever código que qualquer pessoa possa entender

# Código pouco legível
x <- c(1, 2, 3)
y <- x * 2
print(y)

# Código legível
valores <- c(1, 2, 3)
dobro_valores <- valores * 2
print(dobro_valores)

# Função com nomes descritivos
calcular_media_movel <- function(vetor, janela) {
  soma <- sum(vetor)
  tamanho <- length(vetor)
  media <- soma / tamanho
  return(media)
}

dados <- c(10, 20, 30, 40, 50)
resultado <- calcular_media_movel(dados, 2)
print(resultado)
