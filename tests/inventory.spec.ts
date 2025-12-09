import { test, expect } from '@playwright/test';

test('Cyclic Inventory Flow: Scan -> Edit -> Save', async ({ page }) => {
    // 1. Navigate to the Cyclic Inventory page
    await page.goto('http://localhost:5173/cyclic-inventory');

    // 2. Select a Laboratory (assuming mock data or pre-seeded data)
    // We might need to mock localStorage to ensure data exists
    await page.evaluate(() => {
        const mockItems = [
            {
                id: '1',
                ean: '123456',
                name: 'Test Product',
                systemQuantity: 10,
                countedQuantity: 10,
                cost: 100,
                status: 'pending'
            }
        ];
        localStorage.setItem('cyclic_inventory_LAB_TEST', JSON.stringify(mockItems));
        localStorage.setItem('cyclic_inventory_onboarding_seen', 'true');
    });

    // Reload to pick up localStorage
    await page.goto('http://localhost:5173/cyclic-inventory/LAB_TEST');

    // 3. Verify page loaded
    await expect(page.getByText('LAB_TEST')).toBeVisible();
    await expect(page.getByText('Test Product')).toBeVisible();

    // 4. Simulate scanning an item (using the manual scan input or just clicking edit)
    // Since we can't easily mock the camera in this simple test without more setup,
    // we'll test the "Edit" flow which is part of the "Scan -> Edit" process.

    // Click on the item card to edit
    await page.getByText('Test Product').click();

    // 5. Edit Quantity
    const quantityInput = page.getByPlaceholder('Ingresa la cantidad');
    await expect(quantityInput).toBeVisible();
    await quantityInput.fill('15');
    await page.getByRole('button', { name: 'Guardar' }).click();

    // 6. Verify update
    await expect(page.getByText('15')).toBeVisible(); // Counted quantity
    await expect(page.getByText('+5')).toBeVisible(); // Difference badge

    // 7. Finalize Inventory
    await page.getByRole('button', { name: 'Finalizar' }).click();

    // 8. Enter PLEX ID
    await page.getByPlaceholder('Ej: 123456').fill('PLEX-123');
    await page.getByRole('button', { name: 'Guardar y Finalizar' }).click();

    // 9. Verify redirection and success message
    await expect(page.getByText('Inventario guardado')).toBeVisible();
    await expect(page).toHaveURL(/.*\/cyclic-inventory/);
});
