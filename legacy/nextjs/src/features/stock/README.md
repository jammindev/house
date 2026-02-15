# Stock Feature

## Purpose
Inventory management for consumables (cleaning supplies, lightbulbs, filters, etc.) with stock tracking and shopping lists.

## Key Concepts
- **Stock Items**: Consumable products with quantity tracking
- **Reorder Points**: Automatic low-stock alerts
- **Shopping Lists**: Generated from low-stock items
- **Categories**: Group items (cleaning, maintenance, kitchen, etc.)

## Architecture

### Components
- `StockCard`: Item card with quantity, reorder indicator
- `StockForm`: Create/edit form with quantity, location
- `ShoppingList`: Auto-generated list of items to buy
- `StockHistory`: Track usage over time

### Hooks
- `useStock()`: Loads stock items for household
- `useShoppingList()`: Items below reorder point

### Types
- `StockItem`: Main entity
- `StockCategory`: Categorization

## Database Schema
- Table: `stock_items`
  - RLS: household members can CRUD items
  - Fields: `name`, `quantity`, `reorder_point`, `category`, `location_zone_id`

## Import Aliases
- `@stock/components/*`
- `@stock/hooks/*`
- `@stock/types`

## Related Features
- `zones`: Stock location tracking
- `interactions`: Log stock purchases/usage
- `equipment`: Consumables for equipment (filters, etc.)

## Future Enhancements
- Barcode scanning
- Usage predictions
- Bulk edit
- Shopping list export
