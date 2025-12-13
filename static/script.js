// DOM Elements
const rCodeInput = document.getElementById('rCode');
const juliaCodeOutput = document.getElementById('juliaCode');
const transpileBtn = document.getElementById('transpileBtn');
const clearRBtn = document.getElementById('clearRBtn');
const copyJuliaBtn = document.getElementById('copyJuliaBtn');
const errorMessage = document.getElementById('errorMessage');
const exampleButtons = document.querySelectorAll('.btn-load-example');

// Initialize transpiler
const transpiler = new RtoJuliaTranspiler();

// Event Listeners
transpileBtn.addEventListener('click', transpileCode);
clearRBtn.addEventListener('click', clearRCode);
copyJuliaBtn.addEventListener('click', copyToClipboard);

// Load example code when clicking example buttons
exampleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const code = btn.getAttribute('data-code');
        rCodeInput.value = code;
        transpileCode();
    });
});

// Auto-transpile on Enter (Ctrl+Enter)
rCodeInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        transpileCode();
    }
});

/**
 * Transpile R code to Julia
 */
function transpileCode() {
    const rCode = rCodeInput.value.trim();
    
    if (!rCode) {
        showError('Por favor, digite algum código R para transpilar');
        return;
    }

    // Show loading state
    transpileBtn.classList.add('loading');
    hideError();

    try {
        // Transpile using the JavaScript transpiler
        const juliaCode = transpiler.transpile(rCode);
        juliaCodeOutput.textContent = juliaCode;
        // Highlight the code
        hljs.highlightElement(juliaCodeOutput);
    } catch (error) {
        console.error('Error:', error);
        showError(error.message || 'Erro ao transpilar o código');
        juliaCodeOutput.textContent = 'Erro ao transpilar';
    } finally {
        transpileBtn.classList.remove('loading');
    }
}

/**
 * Clear R code input
 */
function clearRCode() {
    rCodeInput.value = '';
    juliaCodeOutput.textContent = 'Clique em ⚡ para transpilar seu código R';
    hideError();
    rCodeInput.focus();
}

/**
 * Copy Julia code to clipboard
 */
function copyToClipboard() {
    const juliaCode = juliaCodeOutput.textContent;
    
    if (!juliaCode || juliaCode === 'Clique em ⚡ para transpilar seu código R') {
        showError('Não há código Julia para copiar. Transpile algo primeiro!');
        return;
    }

    navigator.clipboard.writeText(juliaCode).then(() => {
        // Show success message
        const originalText = copyJuliaBtn.textContent;
        copyJuliaBtn.textContent = '✓ Copiado!';
        copyJuliaBtn.style.background = '#4caf50';
        
        setTimeout(() => {
            copyJuliaBtn.textContent = originalText;
            copyJuliaBtn.style.background = '';
        }, 2000);
    }).catch(() => {
        showError('Erro ao copiar para a área de transferência');
    });
}

/**
 * Show error message
 */
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
    errorMessage.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(hideError, 5000);
}

/**
 * Hide error message
 */
function hideError() {
    errorMessage.classList.remove('show');
    errorMessage.style.display = 'none';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Add some example code on load
    const exampleCode = `# Exemplo simples
x <- 5
y <- 10
resultado <- x + y
print(resultado)`;
    
    // Optionally show the example
    console.log('R to Julia Transpiler loaded!');
});
