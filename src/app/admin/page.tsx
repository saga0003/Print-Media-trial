'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Save, Plus, Trash2, Edit, IndianRupee } from "lucide-react"

interface PriceTier {
  minQuantity: number
  maxQuantity: number
  pricePerUnit: number
}

interface Product {
  id: string
  name: string
  description: string
  category: string
  basePrice: number
  priceTiers: PriceTier[]
  unit: string
}

const initialProducts: Product[] = [
  {
    id: "visiting-cards",
    name: "Visiting Cards",
    description: "Premium business cards with various finish options",
    category: "Business Cards",
    basePrice: 2.5,
    unit: "card",
    priceTiers: [
      { minQuantity: 1, maxQuantity: 99, pricePerUnit: 2.5 },
      { minQuantity: 100, maxQuantity: 249, pricePerUnit: 1.8 },
      { minQuantity: 250, maxQuantity: 499, pricePerUnit: 1.5 },
      { minQuantity: 500, maxQuantity: 999, pricePerUnit: 1.2 },
      { minQuantity: 1000, maxQuantity: 2499, pricePerUnit: 1.0 },
      { minQuantity: 2500, maxQuantity: 999999, pricePerUnit: 0.8 }
    ]
  },
  {
    id: "flyers",
    name: "Flyers",
    description: "Eye-catching promotional flyers for marketing",
    category: "Marketing Materials",
    basePrice: 3.0,
    unit: "flyer",
    priceTiers: [
      { minQuantity: 1, maxQuantity: 49, pricePerUnit: 3.0 },
      { minQuantity: 50, maxQuantity: 99, pricePerUnit: 2.5 },
      { minQuantity: 100, maxQuantity: 249, pricePerUnit: 2.0 },
      { minQuantity: 250, maxQuantity: 499, pricePerUnit: 1.8 },
      { minQuantity: 500, maxQuantity: 999, pricePerUnit: 1.5 },
      { minQuantity: 1000, maxQuantity: 999999, pricePerUnit: 1.2 }
    ]
  },
  {
    id: "brochures",
    name: "Brochures",
    description: "Professional tri-fold and bi-fold brochures",
    category: "Marketing Materials",
    basePrice: 5.0,
    unit: "brochure",
    priceTiers: [
      { minQuantity: 1, maxQuantity: 24, pricePerUnit: 5.0 },
      { minQuantity: 25, maxQuantity: 49, pricePerUnit: 4.5 },
      { minQuantity: 50, maxQuantity: 99, pricePerUnit: 4.0 },
      { minQuantity: 100, maxQuantity: 249, pricePerUnit: 3.5 },
      { minQuantity: 250, maxQuantity: 499, pricePerUnit: 3.0 },
      { minQuantity: 500, maxQuantity: 999999, pricePerUnit: 2.8 }
    ]
  },
  {
    id: "banners",
    name: "Banners",
    description: "Large format banners for events and advertising",
    category: "Large Format",
    basePrice: 50.0,
    unit: "banner",
    priceTiers: [
      { minQuantity: 1, maxQuantity: 4, pricePerUnit: 50.0 },
      { minQuantity: 5, maxQuantity: 9, pricePerUnit: 45.0 },
      { minQuantity: 10, maxQuantity: 24, pricePerUnit: 40.0 },
      { minQuantity: 25, maxQuantity: 49, pricePerUnit: 35.0 },
      { minQuantity: 50, maxQuantity: 999999, pricePerUnit: 30.0 }
    ]
  },
  {
    id: "id-cards",
    name: "ID Cards",
    description: "Professional employee and student ID cards",
    category: "Identification",
    basePrice: 25.0,
    unit: "card",
    priceTiers: [
      { minQuantity: 1, maxQuantity: 9, pricePerUnit: 25.0 },
      { minQuantity: 10, maxQuantity: 24, pricePerUnit: 22.0 },
      { minQuantity: 25, maxQuantity: 49, pricePerUnit: 20.0 },
      { minQuantity: 50, maxQuantity: 99, pricePerUnit: 18.0 },
      { minQuantity: 100, maxQuantity: 999999, pricePerUnit: 15.0 }
    ]
  },
  {
    id: "booklets",
    name: "Booklets",
    description: "Multi-page booklets and catalogs",
    category: "Marketing Materials",
    basePrice: 15.0,
    unit: "booklet",
    priceTiers: [
      { minQuantity: 1, maxQuantity: 9, pricePerUnit: 15.0 },
      { minQuantity: 10, maxQuantity: 24, pricePerUnit: 13.0 },
      { minQuantity: 25, maxQuantity: 49, pricePerUnit: 12.0 },
      { minQuantity: 50, maxQuantity: 99, pricePerUnit: 11.0 },
      { minQuantity: 100, maxQuantity: 999999, pricePerUnit: 10.0 }
    ]
  },
  {
    id: "hoardings",
    name: "Hoarding Prints",
    description: "Large-scale advertising prints for billboards",
    category: "Large Format",
    basePrice: 200.0,
    unit: "hoarding",
    priceTiers: [
      { minQuantity: 1, maxQuantity: 2, pricePerUnit: 200.0 },
      { minQuantity: 3, maxQuantity: 4, pricePerUnit: 180.0 },
      { minQuantity: 5, maxQuantity: 9, pricePerUnit: 160.0 },
      { minQuantity: 10, maxQuantity: 999999, pricePerUnit: 150.0 }
    ]
  }
]

export default function AdminPanel() {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [gstRate, setGstRate] = useState<number>(18)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showSuccess, setShowSuccess] = useState<boolean>(false)

  const updateProduct = (productId: string, updates: Partial<Product>) => {
    setProducts(products.map(product => 
      product.id === productId ? { ...product, ...updates } : product
    ))
  }

  const updatePriceTier = (productId: string, tierIndex: number, updates: Partial<PriceTier>) => {
    setProducts(products.map(product => {
      if (product.id === productId) {
        const updatedTiers = [...product.priceTiers]
        updatedTiers[tierIndex] = { ...updatedTiers[tierIndex], ...updates }
        return { ...product, priceTiers: updatedTiers }
      }
      return product
    }))
  }

  const addPriceTier = (productId: string) => {
    setProducts(products.map(product => {
      if (product.id === productId) {
        const newTier: PriceTier = {
          minQuantity: 1,
          maxQuantity: 10,
          pricePerUnit: 1.0
        }
        return { ...product, priceTiers: [...product.priceTiers, newTier] }
      }
      return product
    }))
  }

  const removePriceTier = (productId: string, tierIndex: number) => {
    setProducts(products.map(product => {
      if (product.id === productId) {
        const updatedTiers = product.priceTiers.filter((_, index) => index !== tierIndex)
        return { ...product, priceTiers: updatedTiers }
      }
      return product
    }))
  }

  const saveChanges = () => {
    // In a real app, this would save to a database
    // For now, we'll just show a success message
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3000)
    
    // Save to localStorage for persistence
    localStorage.setItem('printMediaProducts', JSON.stringify(products))
    localStorage.setItem('printMediaGstRate', gstRate.toString())
  }

  const formatPrice = (price: number) => {
    return `₹${price.toFixed(2)}`
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <Settings className="mr-3 h-8 w-8 text-blue-600" />
              Admin Panel
            </h1>
            <p className="text-gray-600 mt-2">Manage products, pricing, and tax settings</p>
          </div>
          <Button onClick={saveChanges} size="lg" className="bg-green-600 hover:bg-green-700">
            <Save className="mr-2 h-4 w-4" />
            Save All Changes
          </Button>
        </div>

        {showSuccess && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <AlertDescription className="text-green-800">
              ✅ Changes saved successfully!
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="products" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="products">Products & Pricing</TabsTrigger>
            <TabsTrigger value="settings">Tax Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Product List */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle>Products</CardTitle>
                    <CardDescription>Select a product to edit</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {products.map((product) => (
                      <div
                        key={product.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedProduct?.id === product.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedProduct(product)}
                      >
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-gray-600">{product.category}</div>
                        <div className="text-sm font-medium text-blue-600">
                          {formatPrice(product.basePrice)} base price
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Product Editor */}
              <div className="lg:col-span-2">
                {selectedProduct ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Edit {selectedProduct.name}</CardTitle>
                      <CardDescription>Update product details and pricing tiers</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Basic Info */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="name">Product Name</Label>
                          <Input
                            id="name"
                            value={selectedProduct.name}
                            onChange={(e) => updateProduct(selectedProduct.id, { name: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="category">Category</Label>
                          <Input
                            id="category"
                            value={selectedProduct.category}
                            onChange={(e) => updateProduct(selectedProduct.id, { category: e.target.value })}
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={selectedProduct.description}
                          onChange={(e) => updateProduct(selectedProduct.id, { description: e.target.value })}
                          rows={3}
                        />
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="basePrice">Base Price (₹)</Label>
                          <Input
                            id="basePrice"
                            type="number"
                            step="0.01"
                            value={selectedProduct.basePrice}
                            onChange={(e) => updateProduct(selectedProduct.id, { basePrice: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="unit">Unit</Label>
                          <Input
                            id="unit"
                            value={selectedProduct.unit}
                            onChange={(e) => updateProduct(selectedProduct.id, { unit: e.target.value })}
                          />
                        </div>
                      </div>

                      <Separator />

                      {/* Price Tiers */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium">Price Tiers</h4>
                          <Button
                            size="sm"
                            onClick={() => addPriceTier(selectedProduct.id)}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <Plus className="mr-2 h-3 w-3" />
                            Add Tier
                          </Button>
                        </div>
                        
                        <div className="space-y-4">
                          {selectedProduct.priceTiers.map((tier, index) => (
                            <div key={index} className="border rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <Badge variant="outline">Tier {index + 1}</Badge>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => removePriceTier(selectedProduct.id, index)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              
                              <div className="grid md:grid-cols-3 gap-3">
                                <div>
                                  <Label htmlFor={`min-${index}`}>Min Quantity</Label>
                                  <Input
                                    id={`min-${index}`}
                                    type="number"
                                    value={tier.minQuantity}
                                    onChange={(e) => updatePriceTier(selectedProduct.id, index, { 
                                      minQuantity: parseInt(e.target.value) || 1 
                                    })}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`max-${index}`}>Max Quantity</Label>
                                  <Input
                                    id={`max-${index}`}
                                    type="number"
                                    value={tier.maxQuantity}
                                    onChange={(e) => updatePriceTier(selectedProduct.id, index, { 
                                      maxQuantity: parseInt(e.target.value) || 999999 
                                    })}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`price-${index}`}>Price per Unit (₹)</Label>
                                  <Input
                                    id={`price-${index}`}
                                    type="number"
                                    step="0.01"
                                    value={tier.pricePerUnit}
                                    onChange={(e) => updatePriceTier(selectedProduct.id, index, { 
                                      pricePerUnit: parseFloat(e.target.value) || 0 
                                    })}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="flex items-center justify-center py-12">
                      <div className="text-center text-gray-500">
                        <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Select a product from the list to edit its details</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tax Settings</CardTitle>
                <CardDescription>Configure GST and other tax rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-w-md">
                  <Label htmlFor="gstRate">GST Rate (%)</Label>
                  <Input
                    id="gstRate"
                    type="number"
                    step="0.1"
                    value={gstRate}
                    onChange={(e) => setGstRate(parseFloat(e.target.value) || 0)}
                    className="text-lg"
                  />
                  <p className="text-sm text-gray-600 mt-2">
                    Current GST rate: {gstRate}% (applied to all products)
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Business Information</CardTitle>
                <CardDescription>Update your business details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="businessName">Business Name</Label>
                    <Input id="businessName" defaultValue="Print Media Solutions" />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" defaultValue="+91 98765 43210" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" defaultValue="orders@printmedia.com" />
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Textarea id="address" defaultValue="Mumbai, India" rows={3} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}