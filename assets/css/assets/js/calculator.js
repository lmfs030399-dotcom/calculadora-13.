"use strict";

// A TRAVA DE SEGURANÇA: Só executa quando a página termina de carregar.
document.addEventListener("DOMContentLoaded", function() {
  
  const form = document.getElementById("calculatorForm");
  const resultSection = document.getElementById("resultCard");
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

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

  // Busca JSON externamente, usa regras internas se falhar
  async function loadTaxTables() {
    try {
      const response = await fetch('assets/data/tabelas.json');
      if(response.ok) {
        const data = await response.json();
        if(data["2026"]) {
          taxTables = data;
        }
      }
    } catch (error) {
      console.log("Modo offline: rodando com regras embutidas.");
    }
  }

  // Previne erros ao ler campos vazios
  function number(id) {
    const element = document.getElementById(id);
    if (!element || element.value === "") return 0;
    const value = Number(element.value.replace(',', '.'));
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

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

  function calculate() {
    const yearSelect = document.getElementById("year");
    const selectedYear = yearSelect ? yearSelect.value : "2026";
    const currentRules = taxTables[selectedYear] || defaultRules["2026"];

    const salary = number("salary");
    if (salary <= 0) {
      alert("Por favor, preencha o Salário Bruto.");
      return;
    }

    let months = calculateMonthsFromAdmission(document.getElementById("admission").value, selectedYear);
    if (months === null) {
      const monthInput = document.getElementById("months");
      months = monthInput ? parseInt(monthInput.value, 10) : 12;
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

    document.getElementById("grossResult").textContent = money.format(gross);
    document.getElementById("inssResult").textContent = money.format(inss);
    document.getElementById("irResult").textContent = money.format(ir);
    document.getElementById("netResult").textContent = money.format(net);
    document.getElementById("firstInstallment").textContent = money.format(firstInstallment);
    document.getElementById("secondInstallment").textContent = money.format(secondInstallment);
    
    resultSection.style.display = "block";
    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Inicia o carregamento das tabelas
  loadTaxTables();

  // Garante que o form não recarregue a página
  if (form) {
    form.addEventListener("submit", function(event) { 
      event.preventDefault(); 
      try {
        calculate(); 
      } catch (err) {
        console.error("Erro na execução: ", err);
        alert("Ocorreu um erro no cálculo. Verifique os dados e tente novamente.");
      }
    });
  }

});
