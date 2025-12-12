3.14 isa Float64
2 isa Int
v = [10, 20, 30]
v = Dict(string(i) => v[i] for i in eachindex(v))
v["nome"] = 5
println(v)