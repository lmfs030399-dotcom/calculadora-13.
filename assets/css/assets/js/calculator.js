"use strict";

// Removi qualquer dependência externa. As regras de 2026 já estão embutidas e seguras aqui.
const regras2026 = {
  inss: [
    { limit: 1621.00, rate: 0.075 },
    { limit: 2902.84, rate: 0.090 },
    { limit: 4354.27, rate: 0.120 },
    { limit: 8475.55, rate: 0.140 }
  ],
  irrf: {
    dependentDeduction: 189.59,
    brackets: [
      { limit: 2428.80, rate: 0.000, deduction: 0.00 },
      { limit: 2826.65, rate: 0.075, deduction: 182.16 },
      { limit: 3751.05, rate: 0.150, deduction: 394.16 },
      { limit: 4664.68, rate: 0.225, deduction: 675.49 },
      { limit: 99999999, rate: 0.275, deduction: 908.73 }
    ]
  }
};

const formatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Função segura para ler os campos
function pegarNumero(id) {
  const el = document.getElementById(id);
  if (!el || el.value === "") return 0;
  const val = Number(el.value.replace(',', '.'));
  return isNaN(val) ? 0 : val;
}

// Matemática dos impostos
function calcularINSS(base) {
  let imposto = 0, anterior = 0;
  for (let faixa of regras2026.inss) {
    if (base <= anterior) break;
    let tributavel = Math.min(base, faixa.limit) - anterior;
    imposto += tributavel * faixa.rate;
    anterior = faixa.limit;
  }
  return imposto;
}

function calcularIRRF(base, dependentes) {
  const deducao = dependentes * regras2026.irrf.dependentDeduction;
  const baseCalculo = Math.max(0, base - deducao);
  let imposto = 0;
  for (let faixa of regras2026.irrf.brackets) {
    if (baseCalculo <= faixa.limit) {
      imposto = (baseCalculo * faixa.rate) - faixa.deduction;
      break;
    }
  }
  return Math.max(0, imposto);
}

// A FUNÇÃO PRINCIPAL VINCULADA DIRETO AO BOTÃO
function calcularDecimoTerceiro() {
  const salario = pegarNumero("salary");
  
  if (salario <= 0) {
    alert("Por favor, informe o seu Salário bruto mensal.");
    return;
  }

  // Define os meses trabalhados (Usa a data, ou o campo manual)
  let meses = 12;
  const dataAdmissao = document.getElementById("admission").value;
  
  if (dataAdmissao) {
    const admissao = new Date(`${dataAdmissao}T00:00:00`);
    if (admissao.getFullYear() < 2026) {
      meses = 12;
    } else if (admissao.getFullYear() === 2026) {
      meses = 0;
      for (let mes = admissao.getMonth() + 1; mes <= 12; mes++) {
        let diasNoMes = (admissao.getMonth() + 1 === mes) ? (new Date(2026, mes, 0).getDate() - admissao.getDate() + 1) : 30;
        if (diasNoMes >= 15) meses++;
      }
    } else {
      meses = 0;
    }
  } else {
    meses = parseInt(document.getElementById("months").value, 10) || 12;
  }

  // Soma todas as parcelas avançadas
  const variaveis = pegarNumero("overtime") + pegarNumero("night") + pegarNumero("insalubrity") + pegarNumero("danger") + pegarNumero("commissions");
  const dependentes = pegarNumero("dependents");

  // O CÁLCULO
  const remuneracaoTotal = salario + variaveis;
  const valorBruto = remuneracaoTotal * (meses / 12);
  const inss = calcularINSS(valorBruto);
  const baseIR = Math.max(0, valorBruto - inss);
  const ir = calcularIRRF(baseIR, dependentes);
  
  const primeiraParcela = valorBruto / 2;
  const segundaParcela = Math.max(0, valorBruto - primeiraParcela - inss - ir);
  const liquidoFinal = primeiraParcela + segundaParcela;

  // PREENCHE OS RESULTADOS PRINCIPAIS
  document.getElementById("grossResult").textContent = formatter.format(valorBruto);
  document.getElementById("inssResult").textContent = formatter.format(inss);
  document.getElementById("irResult").textContent = formatter.format(ir);
  document.getElementById("netResult").textContent = formatter.format(liquidoFinal);
  
  document.getElementById("firstInstallment").textContent = formatter.format(primeiraParcela);
  document.getElementById("secondInstallment").textContent = formatter.format(segundaParcela);

  // PREENCHE O QUADRO DE DEMONSTRATIVO DETALHADO
  document.getElementById("demoBase").innerHTML = `Salário Base + Variáveis: <strong>${formatter.format(remuneracaoTotal)}</strong>`;
  document.getElementById("demoAvos").innerHTML = `Avos Adquiridos: <strong>${meses} de 12 meses</strong>`;
  document.getElementById("demoBruto").innerHTML = `Base Bruta Proporcional (13º): <strong>${formatter.format(valorBruto)}</strong>`;
  document.getElementById("demoInss").innerHTML = `Desconto de INSS: <strong>- ${formatter.format(inss)}</strong>`;
  document.getElementById("demoIrrf").innerHTML = `Desconto de Imposto de Renda: <strong>- ${formatter.format(ir)}</strong>`;
  document.getElementById("demoLiquido").innerHTML = `Total Líquido a Receber: <strong>${formatter.format(liquidoFinal)}</strong>`;

  // MOSTRA A CAIXA E ROLA A TELA
  const resultCard = document.getElementById("resultCard");
  resultCard.style.display = "block";
  resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

// CONECTA O BOTÃO DIRETAMENTE (Impede a página de recarregar)
document.getElementById("btnCalcular").addEventListener("click", calcularDecimoTerceiro);
