# Indicadores Políticos - Guaguas Municipales

## 🎯 Objetivo

Estos indicadores están diseñados para **exponer desigualdades** en el servicio de transporte público de Las Palmas de Gran Canaria, combinando datos socioeconómicos del INE con métricas de servicio GTFS.

## 🚨 Indicadores Críticos

### 1. **Trampa del Paro** (Unemployment Trap)

**Fórmula**: Combina alto desempleo + baja frecuencia de servicio

**Interpretación**:
- Valores altos (>60%) indican zonas donde el desempleo es alto Y el servicio de guaguas es deficiente
- **Impacto social**: Las personas desempleadas tienen dificultades para buscar trabajo si no hay transporte público frecuente
- **Argumento político**: El gobierno abandona a quienes más necesitan movilidad para reinsertarse laboralmente

**Cálculo**:
```
indicator_unemployment_trap = (z_score_desempleo + z_score_baja_frecuencia) / 2
```

**Top 3 secciones más afectadas**:
1. **3501605005**: 39.5% desempleo, 0 eventos/día → 78.1% gravedad
2. **3501601061**: 38.6% desempleo, 0 eventos/día → 77.2% gravedad
3. **3501603044**: 40.4% desempleo, 146 eventos/día → 76.2% gravedad

---

### 2. **Desierto para Mayores** (Elderly Desert)

**Fórmula**: Combina alta proporción de mayores de 65 + baja cobertura a 300m

**Interpretación**:
- Valores altos (>60%) indican zonas con muchos mayores pero poca cobertura de paradas cercanas
- **Impacto social**: Los mayores tienen movilidad reducida y dependen más del transporte público
- **Argumento político**: El gobierno aísla a la población más vulnerable y dependiente

**Cálculo**:
```
indicator_elderly_desert = (z_score_mayores_65 + z_score_baja_cobertura) / 2
```

**Características**:
- Varias secciones con 100% de gravedad (población mayor + 0% cobertura)
- Promedio de población mayor: 21.1% (±5.2%)

---

### 3. **Brecha Educativa** (Education Gap)

**Fórmula**: Combina baja educación + baja cobertura de transporte

**Interpretación**:
- Valores altos (>60%) indican zonas con bajo nivel educativo Y mala cobertura de transporte
- **Impacto social**: Menor acceso a oportunidades educativas y laborales
- **Argumento político**: Perpetúa la desigualdad social al dificultar la movilidad de los menos educados

**Cálculo**:
```
indicator_education_gap = (z_score_educacion_baja + z_score_baja_cobertura) / 2
```

**Datos de contexto**:
- Promedio de educación baja (primaria + secundaria 1ª etapa): 40.2% (±10.4%)

---

### 4. **Clase Trabajadora** (Working Class - Contexto)

**Fórmula**: % ocupados en agricultura + industria + construcción

**Interpretación**:
- Muestra la distribución de trabajadores en sectores tradicionalmente menos favorecidos
- **Uso**: Cruzar con los otros indicadores para mostrar que las zonas obreras están peor servidas
- **Argumento político**: El gobierno privilegia zonas de servicios/oficinas sobre barrios obreros

**Cálculo**:
```
indicator_working_class = (occ_agricultura + occ_industria + occ_construccion) / total_ocupados
```

**Promedio**: 10.9% de trabajadores en sectores "obreros"

---

## 📊 Metodología Estadística

### Normalización con Z-Scores

Todos los indicadores críticos usan **z-scores normalizados** para combinar variables de diferentes escalas:

1. **Calcular z-score**: `(valor - media) / desviación_estándar`
2. **Normalizar a rango 0-1**: `(z-score + 3) / 6`
3. **Combinar indicadores**: Promedio de z-scores normalizados
4. **Resultado**: Valor entre 0 (sin problema) y 1 (problema crítico)

### Estadísticas de Normalización

- **Desempleo**: Media 19.6% (±7.6%)
- **Mayores 65+**: Media 21.1% (±5.2%)
- **Educación baja**: Media 40.2% (±10.4%)
- **Cobertura 300m**: Media 93.0% (±19.7%)
- **Frecuencia diaria**: Media 302 eventos (±405)

---

## 🎨 Escalas de Color en el Mapa

Todos los indicadores políticos usan **escala roja** (cuanto más rojo, peor):

```
0.0 → Blanco (sin problema)
0.2 → Rojo muy claro
0.4 → Rojo claro
0.6 → Rojo medio
0.8 → Rojo oscuro
1.0 → Rojo muy oscuro (crítico)
```

**Interpretación visual**:
- Zonas blancas/rosadas: Servicio adecuado para el perfil sociodemográfico
- Zonas rojas: **DESIGUALDAD GRAVE** - Alta necesidad de transporte + bajo servicio

---

## 💡 Cómo Usar Estos Indicadores

### Para Activismo Político

1. **Identifica zonas críticas** (rojo oscuro en el mapa)
2. **Crúzalas con datos demográficos** (mayores, desempleados, baja educación)
3. **Compara con zonas privilegiadas** (alta cobertura, alta frecuencia)
4. **Genera narrativa**: "El gobierno abandona a los barrios obreros/mayores/desempleados"

### Ejemplos de Argumentos

**Trampa del Paro**:
> "La sección 3501605005 tiene 39.5% de desempleo pero CERO servicio de guaguas. ¿Cómo se supone que esta gente va a buscar trabajo?"

**Desierto para Mayores**:
> "10 secciones censales con alta población mayor no tienen NI UNA SOLA parada a menos de 300 metros. El gobierno condena a los mayores al aislamiento."

**Brecha Educativa**:
> "Las zonas con menor nivel educativo son precisamente las que tienen peor transporte público. El gobierno perpetúa la desigualdad."

---

## 📈 Datos de Fuente

### Datos Socioeconómicos (INE 2023)
- `Poblacion_total.json` - 279 secciones censales
- `Poblacion_65_o_mas.json` - Población mayor por sección
- `poblacion_16_mas_anos_por_relacion_con_actividad.json` - Ocupados/parados
- `poblacion_15_mas_anos_por_pais_nacimiento_nivel_estudios.json` - Nivel educativo
- `ocupados_16_o_mas_anos_por_rama_de_actividad.json` - Sectores económicos

### Datos de Transporte (GTFS)
- 848 paradas con geometrías
- 183,871 eventos de stop_times
- Fecha de referencia: 2025-01-07 (martes típico)
- 5 servicios activos

---

## 🔧 Actualización de Datos

```bash
# Importar datos socioeconómicos
npm run import:socioeconomic

# Calcular indicadores políticos
npm run build:indicators

# Importar todo desde cero
npm run import:all
```

---

## ⚖️ Nota Legal

Estos indicadores están construidos con datos públicos oficiales:
- **INE**: Instituto Nacional de Estadística (datos censales 2023)
- **GTFS**: General Transit Feed Specification (Guaguas Municipales)

Los indicadores NO manipulan datos, solo los combinan para exponer patrones de desigualdad.

---

## 🎯 Resumen Ejecutivo

### Principales Hallazgos

1. **279 secciones censales** analizadas en Las Palmas de Gran Canaria
2. **Promedio de desempleo**: 19.6% (algunas secciones >40%)
3. **Promedio de población mayor**: 21.1%
4. **10+ secciones** con problemas críticos múltiples

### Zonas Más Afectadas

Las secciones con códigos **3501605XXX** y **3501601XXX** concentran los mayores problemas:
- Alto desempleo (30-40%)
- Alta población mayor (>25%)
- Baja o nula cobertura de transporte
- Frecuencia de servicio muy baja o inexistente

### Mensaje Político Central

> **El gobierno de Las Palmas abandona sistemáticamente a los barrios con mayor vulnerabilidad socioeconómica, perpetuando la desigualdad a través de un servicio de transporte público deficiente.**

---

**Fecha de análisis**: 2025-01-16
**Versión de datos**: INE 2023, GTFS 2025-01-07
