# Exemplo de manipulação de eventos e callbacks em R

# Função para processar clique de botão
processar_clique <- function(nome) {
  mensagem <- paste("Olá,", nome, "! Você clicou no botão!")
  return(mensagem)
}

# Simulando evento de clique
resultado1 <- processar_clique("Paulo")
print(resultado1)

resultado2 <- processar_clique("Maria")
print(resultado2)

# Função para processar entrada de usuário
validar_entrada <- function(texto) {
  if (nchar(texto) == 0) {
    return("Digite algo válido")
  }
  return(paste("Você digitou:", texto))
}

mensagem1 <- validar_entrada("teste")
print(mensagem1)

mensagem2 <- validar_entrada("")
print(mensagem2)

# Função para responder a eventos
responder_evento <- function(tipo, valor) {
  if (tipo == "clique") {
    return(paste("Botão clicado com valor:", valor))
  } else if (tipo == "entrada") {
    return(paste("Entrada recebida:", valor))
  }
  return("Evento desconhecido")
}

evento1 <- responder_evento("clique", "btn1")
print(evento1)

evento2 <- responder_evento("entrada", "dados")
print(evento2)
