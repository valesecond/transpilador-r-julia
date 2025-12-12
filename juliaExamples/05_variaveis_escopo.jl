x_global = 10
function f()
    x_local = 5
    return x_local
end
f()
isdefined(Main, Symbol("x_local"))