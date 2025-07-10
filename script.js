// script.js ordenado, funcional, con RSI, MACD y Bandas de Bollinger integradas sin errores

// Esperar a que el DOM cargue
document.addEventListener("DOMContentLoaded", () => {
  // Obtener referencias a los elementos del DOM
  const ctx = document.getElementById("grafico").getContext("2d");
  const ctxRSI = document.getElementById("graficoRSI").getContext("2d");
  const ctxMACD = document.getElementById("graficoMACD").getContext("2d");
  const monedaLabel = document.getElementById("moneda-label");
  const precioActualLabel = document.getElementById("precio-actual");
  const selectorMoneda = document.getElementById("selector-moneda");
  const selectorVelas = document.getElementById("selector-velas");
  const ctxADX = document.getElementById("graficoADX").getContext("2d"); // ADX
  const toggleBollingerBtn = document.getElementById("toggleBollinger"); // invisible banda de boiller
  const toggleEMABtn = document.getElementById("toggleEMA"); // EMA

  // Variables de estado
  let chart, rsiChart, macdChart, adxChart;
  let simbolo = "BTCUSDT";
  let intervaloVelas = "1m";
  const intervaloActualizacion = 5000;
  let timerId;
  let mostrarBollinger = true; //invisible banda de boiller
  let mostrarEMA = false; // MOSTAR EMA

  // Funciones para indicadores
  function calcularRSI(cierres, periodo = 14) {
    let rsi = [];
    for (let i = periodo; i < cierres.length; i++) {
      let ganancias = 0,
        perdidas = 0;
      for (let j = i - periodo; j < i; j++) {
        let cambio = cierres[j + 1] - cierres[j];
        if (cambio > 0) ganancias += cambio;
        else perdidas -= cambio;
      }
      let rs = ganancias / (perdidas || 1);
      rsi.push(100 - 100 / (1 + rs));
    }
    return rsi;
  }
  //CALCULAR EMA
  function calcularEMA(cierres, periodo) {
    const k = 2 / (periodo + 1);
    let emaArray = [cierres[0]];
    for (let i = 1; i < cierres.length; i++) {
      emaArray.push(cierres[i] * k + emaArray[i - 1] * (1 - k));
    }
    return emaArray;
  }
  // calcularMACD
  function calcularMACD(cierres) {
    const ema12 = calcularEMA(cierres, 12);
    const ema26 = calcularEMA(cierres, 26);
    const macdLine = ema12.map((v, i) => v - ema26[i]);
    const signalLine = calcularEMA(macdLine, 9);
    const histograma = macdLine.map((v, i) => v - signalLine[i]);
    return { macdLine, signalLine, histograma };
  }
  // CALCULO ADX
  function calcularADX(highs, lows, closes, period = 14) {
    let plusDM = [],
      minusDM = [],
      tr = [],
      dx = [],
      adx = [];

    for (let i = 1; i < highs.length; i++) {
      const upMove = highs[i] - highs[i - 1];
      const downMove = lows[i - 1] - lows[i];
      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
      tr.push(
        Math.max(
          highs[i] - lows[i],
          Math.abs(highs[i] - closes[i - 1]),
          Math.abs(lows[i] - closes[i - 1])
        )
      );
    }

    const smoothedPlusDM = calcularEMA(plusDM, period);
    const smoothedMinusDM = calcularEMA(minusDM, period);
    const smoothedTR = calcularEMA(tr, period);

    for (let i = 0; i < smoothedTR.length; i++) {
      const plusDI = 100 * (smoothedPlusDM[i] / smoothedTR[i]);
      const minusDI = 100 * (smoothedMinusDM[i] / smoothedTR[i]);
      const dxValue = (100 * Math.abs(plusDI - minusDI)) / (plusDI + minusDI);
      dx.push(dxValue);
    }

    adx = calcularEMA(dx, period);
    return adx;
  }

  //CALCULAR BOILER
  function calcularBollingerBands(cierres, periodo = 20, desviacion = 2) {
    let bandas = { media: [], superior: [], inferior: [] };
    for (let i = periodo - 1; i < cierres.length; i++) {
      const slice = cierres.slice(i - periodo + 1, i + 1);
      const promedio = slice.reduce((a, b) => a + b) / periodo;
      const varianza =
        slice.reduce((acc, val) => acc + Math.pow(val - promedio, 2), 0) /
        periodo;
      const desviacionStd = Math.sqrt(varianza);

      bandas.media.push(promedio);
      bandas.superior.push(promedio + desviacion * desviacionStd);
      bandas.inferior.push(promedio - desviacion * desviacionStd);
    }
    return bandas;
  }

  async function obtenerDatos() {
    try {
      let limit = 80;
      if (intervaloVelas === "1d") limit = 40;
      const response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${simbolo}&interval=${intervaloVelas}&limit=${limit}`
      );
      const raw = await response.json();
      return raw.map((d) => ({
        x: d[0],
        o: parseFloat(d[1]),
        h: parseFloat(d[2]),
        l: parseFloat(d[3]),
        c: parseFloat(d[4]),
      }));
    } catch (error) {
      console.error("❌ Error al obtener datos:", error);
      return [];
    }
  }

  // actualizar graficos
  async function actualizarGrafico() {
    const datos = await obtenerDatos();
    if (datos.length === 0) return;

    const cierres = datos.map((d) => d.c);
    const boll = calcularBollingerBands(cierres);
    const ema12 = calcularEMA(cierres, 12);
    const ema26 = calcularEMA(cierres, 26);
    const etiquetas = datos.slice(-boll.media.length).map((d) => d.x);
    const datosEMA12 = etiquetas.map((x, i) => ({
      x,
      y: ema12[i + (ema12.length - etiquetas.length)],
    }));
    const datosEMA26 = etiquetas.map((x, i) => ({
      x,
      y: ema26[i + (ema26.length - etiquetas.length)],
    }));

    const datosBollinger = {
      media: etiquetas.map((x, i) => ({ x, y: boll.media[i] })),
      superior: etiquetas.map((x, i) => ({ x, y: boll.superior[i] })),
      inferior: etiquetas.map((x, i) => ({ x, y: boll.inferior[i] })),
    };
    const ultimoPrecio = cierres[cierres.length - 1];
    precioActualLabel.textContent = ultimoPrecio;

    if (!chart) {
      // Primera creación
      chart = new Chart(ctx, {
        type: "candlestick",
        data: {
          datasets: [
            {
              label: simbolo,
              data: datos,
              color: { up: "#26a69a", down: "#ef5350", unchanged: "#999999" },
            },
            {
              label: "Banda Superior",
              type: "line",
              data: datosBollinger.superior,
              borderColor: "rgba(255,0,0,0.4)",
              borderWidth: 1,
              pointRadius: 0,
            },
            {
              label: "Media Móvil",
              type: "line",
              data: datosBollinger.media,
              borderColor: "rgba(0,0,255,0.4)",
              borderWidth: 1,
              pointRadius: 0,
            },
            {
              label: "Banda Inferior",
              type: "line",
              data: datosBollinger.inferior,
              borderColor: "rgba(0,255,0,0.4)",
              borderWidth: 1,
              pointRadius: 0,
            },
            {
              label: "EMA 12",
              type: "line",
              data: datosEMA12,
              borderColor: "orange",
              borderWidth: 1,
              pointRadius: 0,
              hidden: !mostrarEMA,
            },
            {
              label: "EMA 26",
              type: "line",
              data: datosEMA26,
              borderColor: "purple",
              borderWidth: 1,
              pointRadius: 0,
              hidden: !mostrarEMA,
            },
          ],
        },
        options: {
          responsive: true,
          scales: {
            x: { type: "time", time: { unit: "minute" } },
            y: { title: { display: true, text: "Precio USDT" } },
          },
        },
      });
    } else {
      // Solo actualiza los datos
      chart.data.datasets[0].data = datos;
      chart.data.datasets[1].data = datosBollinger.superior;
      chart.data.datasets[2].data = datosBollinger.media;
      chart.data.datasets[3].data = datosBollinger.inferior;
      chart.data.datasets[4].data = datosEMA12;
      chart.data.datasets[5].data = datosEMA26;

      // ✅ Controla visibilidad según el botón
      chart.data.datasets[1].hidden = !mostrarBollinger;
      chart.data.datasets[2].hidden = !mostrarBollinger;
      chart.data.datasets[3].hidden = !mostrarBollinger;
      chart.data.datasets[4].hidden = !mostrarEMA;
      chart.data.datasets[5].hidden = !mostrarEMA;
      chart.update();
    }
  }
  // NUEVO: Botón para ocultar/mostrar EMAs
  toggleEMABtn.addEventListener("click", () => {
    mostrarEMA = !mostrarEMA;
    if (chart) {
      chart.data.datasets[4].hidden = !mostrarEMA;
      chart.data.datasets[5].hidden = !mostrarEMA;
      chart.update();
    }
  });

  // actulazacion de indicadores
  async function actualizarIndicadores() {
    const datos = await obtenerDatos();
    if (datos.length === 0) return;
    const cierres = datos.map((d) => d.c);

    // RSI
    const rsi = calcularRSI(cierres);
    if (!rsiChart) {
      rsiChart = new Chart(ctxRSI, {
        type: "line",
        data: {
          labels: rsi.map((_, i) => i),
          datasets: [{ label: "RSI", data: rsi, borderColor: "blue" }],
        },
      });
    } else {
      rsiChart.data.labels = rsi.map((_, i) => i);
      rsiChart.data.datasets[0].data = rsi;
      rsiChart.update();
    }

    // MACD
    const { macdLine, signalLine, histograma } = calcularMACD(cierres);
    if (!macdChart) {
      macdChart = new Chart(ctxMACD, {
        type: "bar",
        data: {
          labels: macdLine.map((_, i) => i),
          datasets: [
            {
              type: "line",
              label: "MACD",
              data: macdLine,
              borderColor: "green",
              borderWidth: 2,
            },
            {
              type: "line",
              label: "Signal",
              data: signalLine,
              borderColor: "red",
              borderWidth: 2,
            },
            {
              type: "bar",
              label: "Histograma",
              data: histograma,
              backgroundColor: histograma.map((v) =>
                v >= 0 ? "rgba(0,200,0,0.5)" : "rgba(200,0,0,0.5)"
              ),
            },
          ],
        },
      });
    } else {
      macdChart.data.labels = macdLine.map((_, i) => i);
      macdChart.data.datasets[0].data = macdLine;
      macdChart.data.datasets[1].data = signalLine;
      macdChart.data.datasets[2].data = histograma;
      macdChart.update();
    }

    // ADX
    const highs = datos.map((d) => d.h);
    const lows = datos.map((d) => d.l);
    const closes = datos.map((d) => d.c);
    const adxValues = calcularADX(highs, lows, closes);

    // Color dinámico: si ADX > 25, fuerte tendencia (verde), si no, débil (gris)
    const coloresADX = adxValues.map((v) =>
      v > 25 ? "rgba(0,200,0,0.7)" : "rgba(150,150,150,0.5)"
    );

    // Actualiza o crea el gráfico ADX
    if (!adxChart) {
      adxChart = new Chart(ctxADX, {
        type: "bar",
        data: {
          labels: adxValues.map((_, i) => i),
          datasets: [
            {
              label: "ADX",
              data: adxValues,
              backgroundColor: coloresADX,
            },
          ],
        },
      });
    } else {
      adxChart.data.labels = adxValues.map((_, i) => i);
      adxChart.data.datasets[0].data = adxValues;
      adxChart.data.datasets[0].backgroundColor = coloresADX;
      adxChart.update();
    }
    // 🧠 Verificar condiciones de alerta
    verificarCondiciones({
      rsi,
      macd: { macdLine, signalLine },
      adx: adxValues,
    });
  }

  // boton banda de boillinger
  toggleBollingerBtn.addEventListener("click", () => {
    mostrarBollinger = !mostrarBollinger;

    if (chart) {
      chart.data.datasets[1].hidden = !mostrarBollinger;
      chart.data.datasets[2].hidden = !mostrarBollinger;
      chart.data.datasets[3].hidden = !mostrarBollinger;
      chart.update();
    }
  });

  // INICIACION DE ACTUALIZACIONES
  function iniciarActualizacion() {
    clearInterval(timerId);
    actualizarGrafico();
    actualizarIndicadores();
    timerId = setInterval(() => {
      actualizarGrafico();
      actualizarIndicadores();
    }, intervaloActualizacion);
  }

  // Eventos de selección
  selectorMoneda.addEventListener("change", () => {
    simbolo = selectorMoneda.value;
    monedaLabel.textContent = simbolo.replace("USDT", "/USDT");
    chart?.destroy();
    rsiChart?.destroy();
    macdChart?.destroy();
    chart = rsiChart = macdChart = null;
    iniciarActualizacion();
  });

  selectorVelas.addEventListener("change", () => {
    intervaloVelas = selectorVelas.value;
    chart?.destroy();
    rsiChart?.destroy();
    macdChart?.destroy();
    chart = rsiChart = macdChart = null;
    iniciarActualizacion();
  });

  iniciarActualizacion();

  // === SISTEMA DE ALERTAS CENTRALIZADO ===

  function registrarEvento(mensaje) {
    console.log("🔔 ALERTA:", mensaje);
    // 🔜 Aquí puedes agregar notificación visual, sonora o envío a Telegram
  }

  function verificarCondiciones({ rsi, macd, adx }) {
    const ultimaRSI = rsi.at(-1);
    const ultimaMACD = macd.macdLine.at(-1);
    const ultimaSignal = macd.signalLine.at(-1);
    const penultimaMACD = macd.macdLine.at(-2);
    const penultimaSignal = macd.signalLine.at(-2);
    const ultimaADX = adx.at(-1);

    if (ultimaRSI < 30) {
      registrarEvento("⚠️ RSI < 30: posible sobreventa");
    }

    if (ultimaMACD > ultimaSignal && penultimaMACD < penultimaSignal) {
      registrarEvento("📈 Cruce alcista en MACD");
    }

    if (ultimaADX > 25) {
      registrarEvento("🔥 ADX > 25: tendencia fuerte");
    }
  }
});
