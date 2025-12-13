# Expressividade: escrever código que comunica claramente a intenção

# Menos expressivo
v <- c(1, 2, 3, 4)
print(v^2)

# Mais expressivo
numeros <- c(1, 2, 3, 4)
quadrados <- numeros^2
print(quadrados)

# Função expressiva
calcular_area_circulo <- function(raio) {
  pi_valor <- 3.14159
  area <- pi_valor * raio^2
  return(area)
}

raio_cm <- 5
area_cm2 <- calcular_area_circulo(raio_cm)
print(area_cm2)
