// Validação de CPF (dígitos verificadores) — usada para rejeitar CPFs inválidos antes de chamar a AllowPay.

function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

function isValidCPF(rawCpf) {
    const cpf = onlyDigits(rawCpf);

    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
        return false;
    }

    const digits = cpf.split('').map(Number);

    const calcCheckDigit = (length) => {
        let sum = 0;
        for (let i = 0; i < length; i++) {
            sum += digits[i] * (length + 1 - i);
        }
        const remainder = (sum * 10) % 11;
        return remainder === 10 ? 0 : remainder;
    };

    return calcCheckDigit(9) === digits[9] && calcCheckDigit(10) === digits[10];
}

module.exports = { isValidCPF, onlyDigits };
