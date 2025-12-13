# Exemplos de paradigmas suportados pela linguagem R

# Paradigma Imperativo / Procedural
# Sequência de instruções que alteram o estado do programa
soma_total <- 0
for (i in 1:5) {
  soma_total <- soma_total + i
}
print(soma_total)

# Paradigma Funcional
# Programação baseada em funções, evitando efeitos colaterais
numeros <- c(1, 2, 3, 4)
quadrados <- c(numeros[1]^2, numeros[2]^2, numeros[3]^2, numeros[4]^2)
print(quadrados)

# Função como objeto de primeira classe
dobro <- function(x) x * 2
resultado_dobro <- dobro(5)
print(resultado_dobro)

# Paradigma com listas e manipulação de dados
lista_dados <- c(10, 20, 30, 40, 50)
media_lista <- mean(lista_dados)
print(media_lista)

# Funções de ordem superior
aplicar_operacao <- function(valor, operacao) {
  return(operacao(valor))
}

quadrado_func <- function(x) x^2
resultado_ordem_superior <- aplicar_operacao(7, quadrado_func)
print(resultado_ordem_superior)

# Composição de funções
adicionar_10 <- function(x) x + 10
multiplicar_2 <- function(x) x * 2

valor_inicial <- 5
resultado_comp1 <- adicionar_10(valor_inicial)
resultado_comp2 <- multiplicar_2(resultado_comp1)
print(resultado_comp2)
