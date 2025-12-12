println((2 + (3 * 4)))
println(((2 + 3) * 4))
struct Myclass
    value
end
import Base: +
+(a::Myclass, b::Myclass) =     "Soma personalizada!"
a = Myclass(1)
b = Myclass(2)
println((a + b))