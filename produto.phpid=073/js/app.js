/* ================================================================
   CRONÔMETROS DOS LOTES
================================================================ */

document.querySelectorAll('[data-end]').forEach(el => {

    const end = new Date(
        el.dataset.end
    ).getTime();

    const tick = () => {

        const left = Math.max(
            0,
            end - Date.now()
        );

        const h = Math.floor(
            left / 3600000
        );

        const m = Math.floor(
            (left % 3600000) / 60000
        );

        const s = Math.floor(
            (left % 60000) / 1000
        );

        el.textContent = left
            ? `⏱ Termina em ${h}h ${m}m ${s}s`
            : 'Encerrado';
    };

    tick();

    setInterval(
        tick,
        1000
    );
});


/* ================================================================
   BOTÕES GENÉRICOS DE COPIAR
================================================================ */

document.querySelectorAll('[data-copy]').forEach(btn => {

    btn.addEventListener('click', async () => {

        const input = document.getElementById(
            btn.dataset.copy
        );

        if (!input) {
            return;
        }

        input.select();

        try {

            await navigator.clipboard.writeText(
                input.value
            );

        } catch (error) {

            document.execCommand('copy');
        }

        const originalText =
            btn.textContent;

        btn.textContent =
            'Copiado ✓';

        setTimeout(
            () => {

                btn.textContent =
                    originalText || 'Copiar';

            },
            1500
        );

    });

});


/* ================================================================
   LANCES DEMO
================================================================ */

document.querySelectorAll('[data-demo-lot]').forEach(box => {

    const lotId =
        box.dataset.demoLot;

    const valueElement =
        box.querySelector(
            '[data-demo-value]'
        );

    const nameElement =
        box.querySelector(
            '[data-demo-name]'
        );

    const nextElement =
        box.querySelector(
            '[data-demo-next]'
        );

    const action =
        document.querySelector(
            '[data-demo-action]'
        );

    let lastValue = '';

    const refresh = async () => {

        try {

            const response = await fetch(
                `demo_bid.php?id=${encodeURIComponent(lotId)}&_=${Date.now()}`,
                {
                    cache: 'no-store',
                    credentials: 'same-origin'
                }
            );

            if (!response.ok) {
                return;
            }

            const data =
                await response.json();

            /*
            |--------------------------------------------------------------------------
            | SEM VALOR = NÃO FAZ NADA
            |--------------------------------------------------------------------------
            */

            if (!data.value) {
                return;
            }

            /*
            |--------------------------------------------------------------------------
            | ATUALIZA VALOR
            |--------------------------------------------------------------------------
            */

            if (valueElement) {

                valueElement.textContent =
                    data.value;

                /*
                |--------------------------------------------------------------------------
                | PEQUENO EFEITO QUANDO O LANCE MUDA
                |--------------------------------------------------------------------------
                */

                if (
                    lastValue
                    && lastValue !== data.value
                ) {

                    valueElement.style.transform =
                        'scale(1.05)';

                    valueElement.style.transition =
                        'transform .18s ease';

                    setTimeout(
                        () => {

                            valueElement.style.transform =
                                'scale(1)';

                        },
                        180
                    );
                }

                lastValue =
                    data.value;
            }

            /*
            |--------------------------------------------------------------------------
            | USUÁRIO JÁ DEU LANCE
            |--------------------------------------------------------------------------
            |
            | Nesse caso o demo_bid.php pausa os lances simulados.
            |
            */

            if (data.user_bid === true) {

                if (nameElement) {

                    nameElement.textContent =
                        'Você';

                }

                /*
                |--------------------------------------------------------------------------
                | AINDA ESTÁ AGUARDANDO O ENCERRAMENTO
                |--------------------------------------------------------------------------
                */

                if (
                    data.won !== true
                ) {

                    if (action) {

                        action.textContent =
                            'Seu lance está na frente';

                        action.style.pointerEvents =
                            'none';

                        action.style.opacity =
                            '.75';

                    }

                    if (nextElement) {

                        nextElement.textContent =
                            data.value;

                    }

                }

                /*
                |--------------------------------------------------------------------------
                | VENCEU
                |--------------------------------------------------------------------------
                */

                if (data.won === true) {

                    if (action) {

                        action.textContent =
                            'Você venceu este lote ✓';

                        action.href =
                            `confirmacao.php?id=${encodeURIComponent(lotId)}&type=bid`;

                        action.style.pointerEvents =
                            'auto';

                        action.style.opacity =
                            '1';

                    }

                    if (nextElement) {

                        nextElement.textContent =
                            'Lote encerrado';

                    }

                }

                return;
            }

            /*
            |--------------------------------------------------------------------------
            | LANCE DEMO NORMAL
            |--------------------------------------------------------------------------
            */

            if (
                nameElement
                && data.name
            ) {

                nameElement.textContent =
                    data.name;

            }

            /*
            |--------------------------------------------------------------------------
            | PRÓXIMO LANCE
            |--------------------------------------------------------------------------
            */

            if (
                nextElement
                && data.next
            ) {

                nextElement.textContent =
                    data.next;

            }

            /*
            |--------------------------------------------------------------------------
            | BOTÃO DAR LANCE
            |--------------------------------------------------------------------------
            */

            if (
                action
                && data.next
            ) {

                action.textContent =
                    `Dar lance mínimo de ${data.next}`;

                action.style.pointerEvents =
                    'auto';

                action.style.opacity =
                    '1';

            }

        } catch (error) {

            /*
            |--------------------------------------------------------------------------
            | NÃO QUEBRA A PÁGINA SE O ENDPOINT FALHAR
            |--------------------------------------------------------------------------
            */

            console.log(
                'Atualização de lance indisponível.'
            );
        }

    };

    /*
    |--------------------------------------------------------------------------
    | ATUALIZA IMEDIATAMENTE
    |--------------------------------------------------------------------------
    */

    refresh();

    /*
    |--------------------------------------------------------------------------
    | DEPOIS A CADA 4 SEGUNDOS
    |--------------------------------------------------------------------------
    */

    setInterval(
        refresh,
        4000
    );

});