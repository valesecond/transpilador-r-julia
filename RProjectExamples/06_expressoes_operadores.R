# Precedência e associatividade
print(2 + 3 * 4)      # 14 — * tem precedência sobre +
print((2 + 3) * 4)    # 20

# Sobrecarga de operadores (método S3)
`+.myclass` <- function(a, b) "Soma personalizada!"

# Criando objetos do tipo "myclass"
a <- structure(1, class="myclass")
b <- structure(2, class="myclass")

# Soma personalizada
print(a + b)   # "Soma personalizada!"