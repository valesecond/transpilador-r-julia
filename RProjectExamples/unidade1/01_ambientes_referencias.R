env <- new.env()
env$x <- 10

f <- function(e) {
  e$x <- e$x + 1
}

f(env)
env$x
