from django.contrib import admin

from .models import StockCategory, StockItem

admin.site.register(StockCategory)
admin.site.register(StockItem)
