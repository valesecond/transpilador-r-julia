env = new.env()
env["x"] = 10
function f(e)
    e["x"] = (e["x"] + 1)
end
f(env)
env["x"]