(function () {
  "use strict";

  const displayEl = document.getElementById("display");
  const expressionEl = document.getElementById("expression");
  const keysEl = document.querySelector(".keys");

  let current = "0";
  let previous = null;
  let operator = null;
  let overwrite = false;
  let lastExpression = "";

  const opLabel = {
    "+": "+",
    "-": "−",
    "*": "×",
    "/": "÷",
  };

  function updateDisplay() {
    displayEl.textContent = formatNumber(current);

    if (previous !== null && operator) {
      expressionEl.textContent =
        formatNumber(previous) +
        " " +
        opLabel[operator] +
        (overwrite ? "" : " " + formatNumber(current));
    } else {
      expressionEl.textContent = lastExpression;
    }

    document.querySelectorAll(".key-op").forEach(function (btn) {
      btn.classList.toggle(
        "is-active",
        overwrite && operator === btn.dataset.value
      );
    });
  }

  function formatNumber(value) {
    if (value === "Error") return value;

    const str = String(value);
    if (str.includes("e") || str.includes("E")) return str;

    const parts = str.split(".");
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.length > 1 ? intPart + "." + parts[1] : intPart;
  }

  function inputDigit(digit) {
    if (overwrite) {
      current = digit;
      overwrite = false;
      lastExpression = "";
      return;
    }

    if (current === "0" && digit !== "0") {
      current = digit;
    } else if (current === "0" && digit === "0") {
      current = "0";
    } else if (current.replace(".", "").length < 12) {
      current += digit;
    }
  }

  function inputDecimal() {
    if (overwrite) {
      current = "0.";
      overwrite = false;
      lastExpression = "";
      return;
    }
    if (!current.includes(".")) {
      current += ".";
    }
  }

  function clearAll() {
    current = "0";
    previous = null;
    operator = null;
    overwrite = false;
    lastExpression = "";
  }

  function toggleSign() {
    if (current === "0" || current === "Error") return;
    current = current.startsWith("-") ? current.slice(1) : "-" + current;
  }

  function percent() {
    const n = parseFloat(current);
    if (Number.isNaN(n)) return;
    current = String(roundResult(n / 100));
  }

  function setOperator(nextOp) {
    if (current === "Error") {
      clearAll();
      return;
    }

    const value = parseFloat(current);

    if (previous === null) {
      previous = value;
    } else if (!overwrite) {
      previous = compute(previous, value, operator);
      if (previous === null) {
        current = "Error";
        operator = null;
        overwrite = true;
        return;
      }
      current = String(previous);
    }

    operator = nextOp;
    overwrite = true;
  }

  function equals() {
    if (operator === null || previous === null || current === "Error") return;

    const value = parseFloat(current);
    const result = compute(previous, value, operator);

    lastExpression =
      formatNumber(previous) +
      " " +
      opLabel[operator] +
      " " +
      formatNumber(current) +
      " =";

    if (result === null) {
      current = "Error";
    } else {
      current = String(result);
    }

    previous = null;
    operator = null;
    overwrite = true;
  }

  function compute(a, b, op) {
    let result;
    switch (op) {
      case "+":
        result = a + b;
        break;
      case "-":
        result = a - b;
        break;
      case "*":
        result = a * b;
        break;
      case "/":
        if (b === 0) return null;
        result = a / b;
        break;
      default:
        return b;
    }
    return roundResult(result);
  }

  function roundResult(n) {
    if (!Number.isFinite(n)) return null;
    const rounded = Math.round(n * 1e10) / 1e10;
    return rounded;
  }

  keysEl.addEventListener("click", function (event) {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;

    switch (action) {
      case "digit":
        inputDigit(btn.dataset.value);
        break;
      case "decimal":
        inputDecimal();
        break;
      case "clear":
        clearAll();
        break;
      case "sign":
        toggleSign();
        break;
      case "percent":
        percent();
        break;
      case "operator":
        setOperator(btn.dataset.value);
        break;
      case "equals":
        equals();
        break;
    }

    updateDisplay();
  });

  document.addEventListener("keydown", function (event) {
    const key = event.key;

    if (key >= "0" && key <= "9") {
      inputDigit(key);
      updateDisplay();
      return;
    }

    if (key === ".") {
      inputDecimal();
      updateDisplay();
      return;
    }

    if (key === "+" || key === "-" || key === "*" || key === "/") {
      event.preventDefault();
      setOperator(key);
      updateDisplay();
      return;
    }

    if (key === "Enter" || key === "=") {
      event.preventDefault();
      equals();
      updateDisplay();
      return;
    }

    if (key === "Escape" || key === "c" || key === "C") {
      clearAll();
      updateDisplay();
      return;
    }

    if (key === "Backspace" && !overwrite) {
      current = current.length > 1 ? current.slice(0, -1) : "0";
      if (current === "-") current = "0";
      updateDisplay();
    }
  });

  updateDisplay();
})();
