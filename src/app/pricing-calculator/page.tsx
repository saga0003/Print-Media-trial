'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Calculator, Info, CheckCircle, IndianRupee } from "lucide-react"

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
  image?: string
}

const products: Product[] = [
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

const GST_RATE = 0.18 // 18% GST

export default function PricingCalculator() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState<number>(100)
  const [priceBreakdown, setPriceBreakdown] = useState<{
    basePrice: number
    subtotal: number
    gstAmount: number
    total: number
    pricePerUnit: number
    savings: number
  } | null>(null)

  const calculatePrice = () => {
    if (!selectedProduct || quantity <= 0) return

    // Find the appropriate price tier
    const tier = selectedProduct.priceTiers.find(tier => 
      quantity >= tier.minQuantity && quantity <= tier.maxQuantity
    )

    if (!tier) return

    const subtotal = quantity * tier.pricePerUnit
    const gstAmount = subtotal * GST_RATE
    const total = subtotal + gstAmount
    const savings = (selectedProduct.basePrice * quantity) - subtotal

    setPriceBreakdown({
      basePrice: selectedProduct.basePrice,
      subtotal,
      gstAmount,
      total,
      pricePerUnit: tier.pricePerUnit,
      savings
    })
  }

  useEffect(() => {
    calculatePrice()
  }, [selectedProduct, quantity])

  const formatPrice = (price: number) => {
    return `₹${price.toFixed(2)}`
  }

  const getCurrentTier = () => {
    if (!selectedProduct || !quantity) return null
    return selectedProduct.priceTiers.find(tier => 
      quantity >= tier.minQuantity && quantity <= tier.maxQuantity
    )
  }

  const getNextTier = () => {
    if (!selectedProduct || !quantity) return null
    const currentTier = getCurrentTier()
    if (!currentTier) return null
    return selectedProduct.priceTiers.find(tier => tier.minQuantity > currentTier.maxQuantity)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 flex items-center justify-center">
            <Calculator className="mr-3 h-8 w-8 text-blue-600" />
            Smart Pricing Calculator
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Get instant quotes with bulk discounts. More copies = Better prices!
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Product Selection */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Select Product & Quantity</CardTitle>
                <CardDescription>
                  Choose your printing product and enter the quantity for instant pricing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="product">Product Type</Label>
                  <Select onValueChange={(value) => {
                    const product = products.find(p => p.id === value)
                    setSelectedProduct(product || null)
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          <div>
                            <div className="font-medium">{product.name}</div>
                            <div className="text-sm text-gray-500">{product.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProduct && (
                  <div>
                    <Label htmlFor="quantity">Quantity ({selectedProduct.unit}s)</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      min="1"
                      className="text-lg"
                    />
                    <div className="mt-2 text-sm text-gray-600">
                      Starting from {formatPrice(selectedProduct.basePrice)} per {selectedProduct.unit}
                    </div>
                  </div>
                )}

                {selectedProduct && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center">
                      <Info className="h-4 w-4 mr-2" />
                      Bulk Discount Tiers
                    </h4>
                    <div className="space-y-1 text-sm">
                      {selectedProduct.priceTiers.map((tier, index) => (
                        <div key={index} className="flex justify-between">
                          <span>
                            {tier.minQuantity === tier.maxQuantity 
                              ? `${tier.minQuantity}+` 
                              : `${tier.minQuantity}-${tier.maxQuantity}`}
                          </span>
                          <span className="font-medium">{formatPrice(tier.pricePerUnit)} each</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Price Breakdown */}
          <div>
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle>Price Breakdown</CardTitle>
                <CardDescription>
                  Real-time pricing with all taxes included
                </CardDescription>
              </CardHeader>
              <CardContent>
                {priceBreakdown ? (
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Quantity:</span>
                      <span className="font-medium">{quantity} {selectedProduct?.unit}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Price per unit:</span>
                      <span className="font-medium">{formatPrice(priceBreakdown.pricePerUnit)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatPrice(priceBreakdown.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GST (18%):</span>
                      <span>{formatPrice(priceBreakdown.gstAmount)}</span>
                    </div>
                    {priceBreakdown.savings > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Bulk Savings:</span>
                        <span>-{formatPrice(priceBreakdown.savings)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span className="text-blue-600">{formatPrice(priceBreakdown.total)}</span>
                    </div>

                    {getNextTier() && (
                      <div className="bg-yellow-50 p-3 rounded-lg text-sm">
                        <div className="font-medium text-yellow-800 mb-1">
                          💡 Save more with bulk pricing!
                        </div>
                        <div className="text-yellow-700">
                          Order {getNextTier()?.minQuantity}+ units to get 
                          {formatPrice(getNextTier()?.pricePerUnit || 0)} per unit
                        </div>
                      </div>
                    )}

                    <Button className="w-full mt-4" size="lg">
                      <IndianRupee className="mr-2 h-4 w-4" />
                      Proceed to Order
                    </Button>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a product and quantity to see pricing</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Product Features */}
        {selectedProduct && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>{selectedProduct.name} Details</CardTitle>
              <CardDescription>{selectedProduct.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <CheckCircle className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <div className="font-medium">Premium Quality</div>
                  <div className="text-sm text-gray-600">High-grade materials</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <div className="font-medium">Fast Delivery</div>
                  <div className="text-sm text-gray-600">2-5 business days</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <CheckCircle className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                  <div className="font-medium">Custom Design</div>
                  <div className="text-sm text-gray-600">Upload your artwork</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <CheckCircle className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                  <div className="font-medium">Support</div>
                  <div className="text-sm text-gray-600">24/7 customer service</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}