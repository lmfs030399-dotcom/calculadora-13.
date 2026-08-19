"use strict";

const form = document.getElementById("calculatorForm");
const resultSection = document.getElementById("result");
const yearSelect = document.getElementById("year");
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Variável global para armazenar as tabelas carregadas do JSON
let taxTables = {};

// 1. Busca os dados do JSON assim que a página carrega
async function loadTaxTables() {
  try {
    const response = await fetch('assets/data/tabelas.json');
    taxTables = await response.json();
    
    // Limpa o select e preenche com os anos disponíveis no JSON (do maior pro menor)
    yearSelect.innerHTML = '';
    Object.keys(taxTables).sort((a, b) => b - a).forEach(year => {
      const option = document.createElement("option");
      option.value = year;
      option.textContent = year;
      yearSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar as tabelas tributárias:", error);
    alert("Erro ao carregar as regras de cálculo. Verifique se o arquivo tabelas.json existe na pasta correta.");
  }
}

// 2. Função auxiliar para pegar valores numéricos dos inputs com segurança
function number(id) {
  const element = document.getElementById(id);
  if (!element || element.value === "") return 0;
  const value = Number(element.value.replace(',', '.')); // Previne erros de digitação
  return Number.isFinite(value) && value > 0 ? value : 0;
}

// 3. Calcula os avos (meses) com base na data de admissão e no ano selecionado
function calculateMonthsFromAdmission(dateString, targetYear) {
  if (!dateString) return null;
  const admission = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(admission.getTime())) return null;
  
  targetYear = parseInt(targetYear, 10);
  
  // Se entrou depois do ano base, não tem direito no ano selecionado
  if (admission.getFullYear() > targetYear) return 0;
  // Se entrou antes do ano base, tem direito aos 12 meses completos
  if (admission.getFullYear() < targetYear) return 12;
  
  let months = 0;
  const startMonth = admission.getMonth() + 1;
  
  for (let month = startMonth; month <= 12; month++) {
    let daysWorked = 30;
    // Verifica os dias trabalhados apenas no mês de admissão
    if (admission.getMonth() + 1 === month) {
      const daysInMonth = new Date(targetYear, month, 0).getDate();
      daysWorked = daysInMonth - admission.getDate() + 1;
    }
    // A lei exige 15 dias ou mais trabalhados no mês para contar 1 avo
    if (daysWorked >= 15) months++;
  }
  return Math.min(months, 12);
}

// 4. Cálculo progressivo do INSS baseado na tabela do ano
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

// 5. Cálculo do Imposto de Renda baseado na tabela do ano
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

// 6. Função principal que orquestra todo o cálculo quando o usuário clica em "Calcular"
function calculate() {
  const selectedYear = yearSelect.value;
  const currentRules = taxTables[selectedYear];

  if (!currentRules) {
    return alert("As regras tributárias para o ano selecionado ainda estão sendo carregadas ou não existem.");
  }

  const salary = number("salary");
  if (salary <= 0) {
    return alert("Por favor, informe um salário base válido.");
  }

  // Define a quantidade de meses (avos)
  let months = calculateMonthsFromAdmission(document.getElementById("admission").value, selectedYear);
  if (months === null) {
    // Se não preencheu a data, usa o campo de meses digitado manualmente
    months = Math.min(12, Math.max(1, Math.round(number("months") || 12)));
  }

  // Soma todas as variáveis (Horas extras, adicionais, etc)
  const variableParams = ["overtime", "night", "insalubrity", "danger", "commissions", "bonus"];
  const variable = variableParams.reduce((acc, curr) => acc + number(curr), 0);
  
  const dependents = Math.max(0, Math.round(number("dependents")));

  // Início da matemática do 13º
  const remuneration = salary + variable;
  const gross = remuneration * (months / 12); // Valor Bruto Proporcional
  
  const firstInstallment = gross / 2; // A primeira parcela é sempre 50% do bruto sem descontos
  
  // Descontos incidem sobre o valor total do 13º
  const inss = calculateINSS(gross, currentRules.inss);
  const irBase = Math.max(0, gross - inss);
  const ir = calculateIRRF(irBase, dependents, currentRules.irrf);
  
  // A segunda parcela abate a primeira que já foi paga + todos os descontos
  const secondInstallment = Math.max(0, gross - firstInstallment - inss - ir);
  const net = firstInstallment + secondInstallment;

  // 7. Atualiza os valores na tela
  document.getElementById("grossResult").textContent = money.format(gross);
  document.getElementById("monthsResult").textContent = `${months}/12`;
  document.getElementById("firstInstallment").textContent = money.format(firstInstallment);
  document.getElementById("inssResult").textContent = money.format(inss);
  document.getElementById("irResult").textContent = money.format(ir);
  document.getElementById("secondInstallment").textContent = money.format(secondInstallment);
  document.getElementById("netResult").textContent = money.format(net);
  
  document.getElementById("explanation").textContent = `O cálculo utilizou a base de ${months}/12 avos sobre uma remuneração total de ${money.format(remuneration)}. As regras tributárias aplicadas foram as do ano base de ${selectedYear}.`;

  // Remove a classe "hidden" para exibir o resultado e rola a tela até ele
  resultSection.classList.remove("hidden");
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });

  // Dispara evento para o Google Analytics (se o usuário tiver aceitado os cookies)
  window.dispatchEvent(new CustomEvent("calculator_completed", { 
    detail: { months: months, gross: gross } 
  }));
}

// 8. Eventos de clique e carregamento
document.addEventListener("DOMContentLoaded", loadTaxTables);

form.addEventListener("submit", (e) => { 
  e.preventDefault(); 
  calculate(); 
});

document.getElementById("newCalculation").addEventListener("click", () => {
  form.reset();
  resultSection.classList.add("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
});
