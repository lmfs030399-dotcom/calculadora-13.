"use strict";

const form = document.getElementById("calculatorForm");
const resultSection = document.getElementById("result");
const yearSelect = document.getElementById("year");
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Variável global para armazenar as tabelas carregadas
let taxTables = {};

// Função para buscar os dados do JSON assim que a página carrega
async function loadTaxTables() {
  try {
    const response = await fetch('assets/data/tabelas.json');
    taxTables = await response.json();
    
    // Atualiza dinamicamente as opções de ano no formulário baseado no JSON
    yearSelect.innerHTML = '';
    Object.keys(taxTables).sort((a, b) => b - a).forEach(year => {
      const option = document.createElement("option");
      option.value = year;
      option.textContent = year;
      yearSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar as tabelas tributárias:", error);
    alert("Erro ao carregar as regras de cálculo. Tente recarregar a página.");
  }
}

function number(id) {
  const element = document.getElementById(id);
  if (!element || element.value === "") return 0;
  const value = Number(element.value);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

// O INSS agora recebe a tabela específica do ano como parâmetro
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

// O IRRF agora recebe a tabela específica do ano como parâmetro
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

// Restante do cálculo (Avos, etc) permanece igual...
function calculate() {
  const selectedYear = yearSelect.value;
  const currentRules = taxTables[selectedYear];

  if (!currentRules) {
    return alert("As regras tributárias para o ano selecionado não estão disponíveis.");
  }

  const salary = number("salary");
  if (salary <= 0) return alert("Informe um salário base válido.");

  // ... (A lógica de meses e variáveis se mantém igual ao código anterior) ...
  let months = 12; // Simplificado aqui para manter o foco nas tabelas
  const variable = 0;
  const dependents = Math.max(0, Math.round(number("dependents")));
  const remuneration = salary + variable;
  const gross = remuneration * (months / 12);
  
  const firstInstallment = gross / 2;
  
  // Usando as regras dinâmicas carregadas do JSON
  const inss = calculateINSS(gross, currentRules.inss);
  const irBase = Math.max(0, gross - inss);
  const ir = calculateIRRF(irBase, dependents, currentRules.irrf);
  
  const secondInstallment = Math.max(0, gross - firstInstallment - inss - ir);
  const net = firstInstallment + secondInstallment;

  // Atualização na tela...
  document.getElementById("grossResult").textContent = money.format(gross);
  document.getElementById("inssResult").textContent = money.format(inss);
  document.getElementById("irResult").textContent = money.format(ir);
  document.getElementById("netResult").textContent = money.format(net);
  
  resultSection.classList.remove("hidden");
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Inicia o carregamento das tabelas ao abrir o site
document.addEventListener("DOMContentLoaded", loadTaxTables);
form.addEventListener("submit", (e) => { e.preventDefault(); calculate(); });
