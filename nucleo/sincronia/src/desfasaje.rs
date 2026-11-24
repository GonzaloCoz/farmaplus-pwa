/// Calcula el tope superior `min(techo_ms, base_ms * 2^intento)` sin desbordamientos.
pub fn calcular_tope_desfasado(intento: u32, base_ms: i64, techo_ms: i64) -> i64 {
    if base_ms <= 0 || techo_ms <= 0 {
        return 0;
    }
    if intento >= 63 {
        return techo_ms;
    }

    let multiplicador = 1_u128 << intento;
    let producto = (base_ms as u128).saturating_mul(multiplicador);
    producto.min(techo_ms as u128) as i64
}

/// Calcula una espera exponencial con desfasaje total acotada en `[0, min(techo_ms, base_ms * 2^intento)]`.
pub fn calcular_espera_desfasada(intento: u32, base_ms: i64, techo_ms: i64, semilla: u64) -> i64 {
    let tope = calcular_tope_desfasado(intento, base_ms, techo_ms);
    if tope <= 0 {
        return 0;
    }

    let aleatorio = mezclar_semilla(semilla, intento);
    let modulo = (tope as u64).wrapping_add(1);
    (aleatorio % modulo) as i64
}

fn mezclar_semilla(semilla: u64, intento: u32) -> u64 {
    // Mezcla SplitMix64 deterministica sobre semilla e intento sin estado compartido.
    let desplazamiento = u64::from(intento).wrapping_mul(0x9E37_79B9_7F4A_7C15);
    let mut estado = semilla
        .wrapping_add(desplazamiento)
        .wrapping_add(0x9E37_79B9_7F4A_7C15);
    estado = (estado ^ (estado >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    estado = (estado ^ (estado >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    estado ^ (estado >> 31)
}
