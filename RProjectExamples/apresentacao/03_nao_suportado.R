resultado <- df %>% filter(idade > 20) %>% select(nome)

aplicar_funcao <- \(x) x * 2

modelo <- lm(salary ~ experience + education, data=employees)

contador <<- 0

nome_pessoa <- pessoa$nome
idade <- pessoa$idade

resultados <- lapply(lista, function(x) x + 1)
medias <- apply(matriz, 2, mean)

mensagem <- glue("Olá {nome}, você tem {idade} anos")

niveis <- factor(c("baixo", "médio", "alto"), levels = c("baixo", "médio", "alto"))

novo_objeto <- new("MinhaClasse", slot1 = 10, slot2 = "texto")

correspondencias <- grep("padrão", vetor)

resultado <- tryCatch({
  1 / 0
}, error = function(e) {
  print("Erro capturado!")
})

texto_formatado <- "Linha 1\nLinha 2\tTabulação\t"

items_presentes <- elementos %in% lista_permitida

sequencia <- seq(0, 1, by = 0.1)

elemento <- lista[[1]]
valor <- df[df$idade > 20, ]
