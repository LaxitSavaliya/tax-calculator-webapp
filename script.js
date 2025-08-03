document.addEventListener('DOMContentLoaded', () => {
    // ---- DOM Elements ----
    const form = document.getElementById('taxForm');
    const previewResult = document.getElementById('previewResult');
    const taxProgress = document.getElementById('taxProgress');
    const resultEl = document.getElementById('result');
    const breakdownEl = document.getElementById('breakdown');
    const comparisonTable = document.getElementById('comparisonTable');
    const historyTableBody = document.querySelector('#historyTable tbody');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const exportCSVHistory = document.getElementById('exportCSVHistory');
    const exportPDFHistory = document.getElementById('exportPDFHistory');
    const clearHistoryBtn = document.getElementById('clearHistory');
    const exportPDFResult = document.getElementById('exportPDF');
    const resultModal = document.getElementById('resultModal');
    const closeModalBtn = document.getElementById('closeModal');

    // ---- Constants and State ----
    const currencySymbols = { INR: '₹', USD: '$', EUR: '€' };
    const oldRegimeRebateLimit = 500000;
    const newRegimeRebateLimit = 700000;

    // ---- Helper Functions ----

    // Sync sliders with number inputs
    const syncSliders = () => {
        const grossInput = document.getElementById('grossIncome');
        const grossSlider = document.getElementById('grossSlider');
        grossInput.addEventListener('input', () => grossSlider.value = grossInput.value);
        grossSlider.addEventListener('input', () => grossInput.value = grossSlider.value);

        const dedInput = document.getElementById('deductions');
        const dedSlider = document.getElementById('deductionsSlider');
        dedInput.addEventListener('input', () => dedSlider.value = dedInput.value);
        dedSlider.addEventListener('input', () => dedInput.value = dedSlider.value);
    };

    // Load user preferences from localStorage
    const loadPreferences = () => {
        const savedRegime = localStorage.getItem('taxRegime');
        const savedCurrency = localStorage.getItem('taxCurrency');
        if (savedRegime) document.getElementById('regime').value = savedRegime;
        if (savedCurrency) document.getElementById('currency').value = savedCurrency;
    };

    // Save user preferences to localStorage
    const savePreferences = () => {
        localStorage.setItem('taxRegime', document.getElementById('regime').value);
        localStorage.setItem('taxCurrency', document.getElementById('currency').value);
    };

    // Dark mode toggle
    const setupDarkMode = () => {
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
            darkModeToggle.querySelector('i').className = 'fas fa-sun';
        }

        darkModeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDark);
            darkModeToggle.querySelector('i').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        });
    };

    // ---- Core Tax Calculation Logic ----
    function calculateTax(regime, ageGroup) {
        let gross = parseFloat(document.getElementById('grossIncome').value) || 0;
        let extra = parseFloat(document.getElementById('extraIncome').value) || 0;
        let deductions = parseFloat(document.getElementById('deductions').value) || 0;
        const currency = document.getElementById('currency').value;
        const symbol = currencySymbols[currency];

        // Input validation
        if (gross < 0 || extra < 0 || deductions < 0) {
            alert('Please enter non-negative values for income and deductions.');
            return null;
        }

        const totalIncome = gross + extra;
        let taxableIncome = totalIncome;
        let tax = 0;
        let surcharge = 0;
        let cess = 0;

        // Old Regime: apply deductions and standard deduction
        if (regime === 'old') {
            const standardDeduction = 50000;
            taxableIncome -= standardDeduction;
            taxableIncome -= deductions;
            if (taxableIncome < 0) taxableIncome = 0;

            // Apply old regime slabs based on age
            if (ageGroup === '<60') {
                if (taxableIncome <= 250000) tax = 0;
                else if (taxableIncome <= 500000) tax = (taxableIncome - 250000) * 0.05;
                else if (taxableIncome <= 1000000) tax = 12500 + (taxableIncome - 500000) * 0.20;
                else tax = 112500 + (taxableIncome - 1000000) * 0.30;
            } else if (ageGroup === '60-80') {
                if (taxableIncome <= 300000) tax = 0;
                else if (taxableIncome <= 500000) tax = (taxableIncome - 300000) * 0.05;
                else if (taxableIncome <= 1000000) tax = 10000 + (taxableIncome - 500000) * 0.20;
                else tax = 110000 + (taxableIncome - 1000000) * 0.30;
            } else { // ageGroup === '>80'
                if (taxableIncome <= 500000) tax = 0;
                else if (taxableIncome <= 1000000) tax = (taxableIncome - 500000) * 0.20;
                else tax = 100000 + (taxableIncome - 1000000) * 0.30;
            }
        }
        // New Regime: no deductions, single slab structure
        else {
            const standardDeduction = 50000;
            taxableIncome -= standardDeduction;
            if (taxableIncome < 0) taxableIncome = 0;

            if (taxableIncome <= 300000) tax = 0;
            else if (taxableIncome <= 600000) tax = (taxableIncome - 300000) * 0.05;
            else if (taxableIncome <= 900000) tax = 15000 + (taxableIncome - 600000) * 0.10;
            else if (taxableIncome <= 1200000) tax = 45000 + (taxableIncome - 900000) * 0.15;
            else if (taxableIncome <= 1500000) tax = 90000 + (taxableIncome - 1200000) * 0.20;
            else tax = 150000 + (taxableIncome - 1500000) * 0.30;
        }

        // Rebate u/s 87A
        const rebateLimit = regime === 'old' ? oldRegimeRebateLimit : newRegimeRebateLimit;
        if (taxableIncome <= rebateLimit) {
            tax = Math.min(tax, (regime === 'old' ? 12500 : 25000));
        }

        // Surcharge calculation
        if (totalIncome > 5000000) {
            if (totalIncome <= 10000000) surcharge = tax * 0.10;
            else if (totalIncome <= 20000000) surcharge = tax * 0.15;
            else if (totalIncome <= 50000000) surcharge = tax * 0.25;
            else surcharge = tax * 0.37;
        }

        // Education Cess (4%)
        if (tax > 0) cess = (tax + surcharge) * 0.04;

        const finalTax = tax + surcharge + cess;
        const finalIncome = totalIncome - finalTax;

        return {
            gross,
            extra,
            deductions,
            totalIncome,
            taxableIncome,
            taxBeforeCess: tax,
            surcharge,
            cess,
            finalTax,
            finalIncome,
            symbol
        };
    }

    // ---- UI Rendering Functions ----

    // Live preview update
    const updateLivePreview = () => {
        const regime = document.getElementById('regime').value;
        const ageGroup = document.getElementById('age').value;
        const res = calculateTax(regime, ageGroup);
        if (!res) return;
        previewResult.textContent = `${res.symbol}${res.finalIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
        const taxPercentage = (res.finalTax / res.totalIncome) * 100;
        taxProgress.style.width = Math.min(taxPercentage, 100) + '%';
    };

    // Render calculation result and breakdown
    const renderResult = (res) => {
        resultEl.textContent = `${res.symbol}${res.finalIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
        breakdownEl.textContent = `
Gross Annual Income:    ${res.symbol}${res.gross.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
Additional Income:      ${res.symbol}${res.extra.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
Total Income:           ${res.symbol}${res.totalIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
Deductions:             ${res.symbol}${res.deductions.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
-------------------------------------------
Taxable Income:         ${res.symbol}${res.taxableIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
-------------------------------------------
Tax before Cess & Surcharge: ${res.symbol}${res.taxBeforeCess.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
Surcharge:              ${res.symbol}${res.surcharge.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
Health & Education Cess: ${res.symbol}${res.cess.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
-------------------------------------------
Total Tax:              ${res.symbol}${res.finalTax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
Final In-Hand Income:   ${res.symbol}${res.finalIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        `.trim();
    };

    // Render old vs new regime comparison table
    const renderComparisonTable = (oldRes, newRes) => {
        comparisonTable.innerHTML = `
            <tr>
                <td>Old Regime</td>
                <td>${oldRes.symbol}${oldRes.finalTax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                <td>${oldRes.symbol}${oldRes.finalIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
            </tr>
            <tr>
                <td>New Regime</td>
                <td>${newRes.symbol}${newRes.finalTax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                <td>${newRes.symbol}${newRes.finalIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
            </tr>
        `;
    };

    // Render history table
    const renderHistory = () => {
        const history = JSON.parse(localStorage.getItem('taxHistory')) || [];
        historyTableBody.innerHTML = history.map(h => `
            <tr>
              <td>${h.date}</td>
              <td>${h.symbol}${h.gross.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
              <td>${h.symbol}${h.deductions.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
              <td>${h.symbol}${h.finalIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
              <td>${h.regime.toUpperCase()}</td>
            </tr>
        `).join('');
    };

    // ---- Chart & History Management ----
    let taxChart;
    const renderChart = (tax, finalIncome) => {
        const ctx = document.getElementById('taxChart').getContext('2d');
        if (taxChart) taxChart.destroy();
        taxChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Total Tax', 'Final Income'],
                datasets: [{
                    data: [tax, finalIncome],
                    backgroundColor: ['#f56565', '#48bb78'],
                    borderColor: 'transparent',
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: document.body.classList.contains('dark-mode') ? '#e2e8f0' : '#2d3748',
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.label || '';
                                if (label) label += ': ';
                                if (context.parsed !== null) {
                                    const currency = document.getElementById('currency').value;
                                    const symbol = currencySymbols[currency];
                                    label += `${symbol}${context.parsed.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    };

    const saveHistory = (entry) => {
        const history = JSON.parse(localStorage.getItem('taxHistory')) || [];
        history.push(entry);
        localStorage.setItem('taxHistory', JSON.stringify(history));
    };

    const exportToCSV = () => {
        const history = JSON.parse(localStorage.getItem('taxHistory')) || [];
        if (history.length === 0) {
            alert("No history available to export!");
            return;
        }

        const headers = ["Date", "Gross Income", "Extra Income", "Deductions", "Final Income", "Regime", "Currency"];
        let csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\n";

        history.forEach(item => {
            const row = [
                `"${item.date}"`,
                item.gross,
                item.extra,
                item.deductions,
                item.finalIncome,
                `"${item.regime}"`,
                `"${item.symbol}"`
            ].join(',');
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "Tax_History.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToPDF = (isHistory) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        if (isHistory) {
            const history = JSON.parse(localStorage.getItem('taxHistory')) || [];
            if (history.length === 0) {
                alert("No history available to export!");
                return;
            }

            doc.setFontSize(16);
            doc.text("Tax Calculation History", 14, 20);

            const tableData = [
                ["Date", "Income", "Deductions", "Final Income", "Regime"],
                ...history.map(item => [
                    item.date,
                    `${item.symbol}${item.gross.toLocaleString('en-IN')}`,
                    `${item.symbol}${item.deductions.toLocaleString('en-IN')}`,
                    `${item.symbol}${item.finalIncome.toLocaleString('en-IN')}`,
                    item.regime.toUpperCase()
                ])
            ];

            doc.autoTable({
                head: [tableData[0]],
                body: tableData.slice(1),
                startY: 30
            });

            doc.save("Tax_History.pdf");
        } else {
            const regime = document.getElementById('regime').value;
            const ageGroup = document.getElementById('age').value;
            const res = calculateTax(regime, ageGroup);
            if (!res) return;
            const oldRes = calculateTax('old', ageGroup);
            const newRes = calculateTax('new', ageGroup);

            doc.setFontSize(16);
            doc.text("Tax Calculation Result", 14, 20);
            doc.setFontSize(12);
            doc.text(`Final In-Hand Income: ${res.symbol}${res.finalIncome.toLocaleString('en-IN')}`, 14, 30);

            let y = 40;
            doc.setFontSize(10);
            const breakdownLines = breakdownEl.innerText.split('\n');
            breakdownLines.forEach(line => {
                doc.text(line, 14, y);
                y += 7;
            });

            const comparisonData = [
                ['Regime', 'Total Tax', 'Final Income'],
                ['Old Regime', `${oldRes.symbol}${oldRes.finalTax.toLocaleString('en-IN')}`, `${oldRes.symbol}${oldRes.finalIncome.toLocaleString('en-IN')}`],
                ['New Regime', `${newRes.symbol}${newRes.finalTax.toLocaleString('en-IN')}`, `${newRes.symbol}${newRes.finalIncome.toLocaleString('en-IN')}`]
            ];

            doc.autoTable({
                startY: y + 10,
                head: [comparisonData[0]],
                body: comparisonData.slice(1)
            });

            doc.save("Tax_Result.pdf");
        }
    };


    // ---- Event Listeners ----
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const regimeSelected = document.getElementById('regime').value;
        const ageGroupSelected = document.getElementById('age').value;
        const res = calculateTax(regimeSelected, ageGroupSelected);

        if (!res) return;

        // Render UI
        renderResult(res);
        const oldRes = calculateTax('old', ageGroupSelected);
        const newRes = calculateTax('new', ageGroupSelected);
        renderComparisonTable(oldRes, newRes);
        renderChart(res.finalTax, res.finalIncome);

        // Show modal
        resultModal.classList.add('open');

        // Save History
        saveHistory({
            date: new Date().toLocaleString(),
            gross: res.gross,
            extra: res.extra,
            deductions: res.deductions,
            finalIncome: res.finalIncome,
            regime: regimeSelected,
            symbol: res.symbol
        });
        renderHistory();
        savePreferences();
    });

    ['grossIncome', 'extraIncome', 'deductions', 'age', 'currency', 'regime'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateLivePreview);
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
        form.reset();
        previewResult.textContent = '₹ 0';
        taxProgress.style.width = '0%';
        localStorage.removeItem('taxRegime');
        localStorage.removeItem('taxCurrency');
        document.getElementById('regime').value = 'old';
        document.getElementById('currency').value = 'INR';
    });

    clearHistoryBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to clear all calculation history?")) {
            localStorage.removeItem('taxHistory');
            renderHistory();
        }
    });

    exportPDFHistory.addEventListener('click', () => exportToPDF(true));
    exportCSVHistory.addEventListener('click', exportToCSV);
    exportPDFResult.addEventListener('click', () => exportToPDF(false));
    closeModalBtn.addEventListener('click', () => resultModal.classList.remove('open'));
    window.addEventListener('click', (e) => {
        if (e.target === resultModal) {
            resultModal.classList.remove('open');
        }
    });

    // Initial setup
    syncSliders();
    loadPreferences();
    setupDarkMode();
    renderHistory();
    updateLivePreview();
});