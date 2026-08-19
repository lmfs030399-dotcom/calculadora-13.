"use strict";

const form = document.getElementById("calculatorForm");
const resultSection = document.getElementById("resultCard");
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Backup local de segurança (Evita que a calculadora quebre caso o tabelas.json falhe ao carregar localmente)
const defaultRules = {
  "2026": {
    "inss": [
      { "limit": 1621.00, "rate": 0.075 },
      { "limit": 2902.84, "rate": 0.090 },
      { "limit": 4354.27, "rate": 0.120 },
      { "limit": 8475.55, "rate": 0.140 }
    ],
    "irrf": {
      "dependentDeduction": 189.59,
      "brackets": [
        { "limit": 2428.80, "rate": 0.000, "deduction": 0.00 },
        { "limit": 2826.65, "rate": 0.075, "deduction": 182.16 },
        { "limit": 3751.05, "rate": 0.150, "deduction": 394.16 },
        { "limit": 4664.68, "rate": 0.225, "deduction": 675.49 },
        { "limit": 99999999, "rate": 0.275, "deduction": 908.73 }
      ]
    }
  }
};

let taxTables = defaultRules;

// 1. Tenta carregar o JSON (se falhar, usa o backup acima)
async function loadTaxTables() {
  try {
    const response = await fetch('assets/data/tabelas.json');
    if(response.ok) {
      taxTables = await response.json();
    }
  } catch (error) {
    console.warn("Aviso: JSON não carregou (provavelmente rodando sem servidor). Usando tabelas de backup internas.");
  }
}

// 2. Função para pegar valores com segurança
function number(id) {
  const element = document.getElementById(id);
  if (!element || element.value === "") return 0;
  const value = Number(element.value.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

// 3. Calcula os avos baseados na data de admissão (se preenchida)
function calculateMonthsFromAdmission(dateString, targetYear) {
  if (!dateString) return null;
  const admission = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(admission.getTime())) return null;
  
  targetYear = parseInt(targetYear, 10);
  if (admission.getFullYear() > targetYear) return 0;
  if (admission.getFullYear() < targetYear) return 12;
  
  let months = 0;
  for (let month = admission.getMonth() + 1; month <= 12; month++) {
    let daysWorked = 30;
    if (admission.getMonth() + 1 === month) {
      const daysInMonth = new Date(targetYear, month, 0).getDate();
      daysWorked = daysInMonth - admission.getDate() + 1;
    }
    if (daysWorked >= 15) months++;
  }
  return Math.min(months, 12);
}

function calculateINSS(base, inssTable) {
  let contribution = 0, previous = 0;
  for (const bracket of inssTable) {
    if (base <= previous) break;
    const taxable = Math.min(base, bracket.limit) - previous;
    contribution += taxable * bracket.rate;
    previous = bracket.limit;
  }
  return Math.max(0, contribution);
}

function calculateIRRF(base, dependents, irrfRules) {
  const deduction = dependents * irrfRules.dependentDeduction;
  const calculationBase = Math.max(0, base - deduction);
  let tax = 0;
  for (const bracket of irrfRules.brackets) {
    if (calculationBase <= bracket.limit) {
      tax = (calculationBase * bracket.rate) - bracket.deduction;
      break;
    }
  }
  return Math.max(0, tax);
}

// 4. A Função Principal Protegida
function calculate() {
  const yearSelect = document.getElementById("year");
  const selectedYear = yearSelect ? yearSelect.value : "2026";
  const currentRules = taxTables[selectedYear] || defaultRules["2026"];

  const salary = number("salary");
  if (salary <= 0) {
    alert("Por favor, preencha o Salário Bruto.");
    return;
  }

  // Verifica Data de Admissão, se vazio usa o Select de Meses
  let months = calculateMonthsFromAdmission(document.getElementById("admission").value, selectedYear);
  if (months === null) {
    months = parseInt(document.getElementById("months").value, 10) || 12;
  }

  const variableParams = ["overtime", "night", "insalubrity", "danger", "commissions"];
  const variable = variableParams.reduce((acc, curr) => acc + number(curr), 0);
  const dependents = Math.max(0, Math.round(number("dependents")));

  const remuneration = salary + variable;
  const gross = remuneration * (months / 12); 
  
  const firstInstallment = gross / 2; 
  
  const inss = calculateINSS(gross, currentRules.inss);
  const irBase = Math.max(0, gross - inss);
  const ir = calculateIRRF(irBase, dependents, currentRules.irrf);
  
  const secondInstallment = Math.max(0, gross - firstInstallment - inss - ir);
  const net = firstInstallment + secondInstallment;

  // Imprime os Resultados
  document.getElementById("grossResult").textContent = money.format(gross);
  document.getElementById("inssResult").textContent = money.format(inss);
  document.getElementById("irResult").textContent = money.format(ir);
  document.getElementById("netResult").textContent = money.format(net);
  document.getElementById("firstInstallment").textContent = money.format(firstInstallment);
  document.getElementById("secondInstallment").textContent = money.format(secondInstallment);
  
  // Exibe a div de Resultado
  resultSection.style.display = "block";
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Carrega os dados na inicialização
document.addEventListener("DOMContentLoaded", loadTaxTables);

// ESTA É A CORREÇÃO PRINCIPAL QUE IMPEDE A PÁGINA DE APAGAR OS DADOS
form.addEventListener("submit", function(event) { 
  event.preventDefault(); // Trava o recarregamento automático da página
  
  try {
    calculate(); 
  } catch (err) {
    console.error("Erro na execução do cálculo: ", err);
    alert("Ocorreu um erro técnico ao calcular. Tente preencher novamente.");
  }
});
