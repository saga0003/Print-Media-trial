'use client'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calculator, Phone, Mail, MapPin, Star, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function Home() {
  const services = [
    {
      title: "Brochure Printing",
      description: "Professional tri-fold and bi-fold brochures",
      icon: "📄",
      minPrice: "₹5",
      features: ["Multiple sizes", "Premium paper", "Full color", "Fast delivery"]
    },
    {
      title: "Flyer Printing",
      description: "Eye-catching promotional flyers",
      icon: "📋",
      minPrice: "₹3",
      features: ["Various sizes", "Glossy/matte", "Bulk discounts", "Quick turnaround"]
    },
    {
      title: "Booklet Printing",
      description: "Multi-page booklets and catalogs",
      icon: "📕",
      minPrice: "₹15",
      features: ["Custom pages", "Perfect binding", "High quality", "Bulk pricing"]
    },
    {
      title: "Banner Printing",
      description: "Large format banners for events",
      icon: "🏳️",
      minPrice: "₹50",
      features: ["Weather resistant", "Multiple sizes", "Vibrant colors", "Durable material"]
    },
    {
      title: "Hoarding Prints",
      description: "Large-scale advertising prints",
      icon: "📢",
      minPrice: "₹200",
      features: ["High resolution", "Outdoor durable", "Custom sizes", "Professional finish"]
    },
    {
      title: "ID Card Printing",
      description: "Professional employee and student ID cards",
      icon: "🪪",
      minPrice: "₹25",
      features: ["PVC cards", "Magnetic stripe", "Photo printing", "Fast delivery"]
    },
    {
      title: "Visiting Cards",
      description: "Premium business cards",
      icon: "💼",
      minPrice: "₹2",
      features: ["Premium paper", "Various finishes", "Round corners", "Quick delivery"]
    }
  ]

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-600 to-purple-700 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-4 bg-white text-blue-600">Professional Print Media</Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Premium Printing Solutions
            <br />
            <span className="text-yellow-300">For Your Business</span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
            High-quality brochure, flyer, banner, and business card printing with instant pricing and fast delivery across India
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/pricing-calculator">
              <Button size="lg" className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold">
                <Calculator className="mr-2 h-5 w-5" />
                Get Instant Quote
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-600">
              View All Services
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Services Overview */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Printing Services</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We offer comprehensive printing solutions with competitive pricing and premium quality
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {services.map((service, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="text-center">
                  <div className="text-4xl mb-2">{service.icon}</div>
                  <CardTitle className="text-lg">{service.title}</CardTitle>
                  <CardDescription>{service.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center mb-4">
                    <span className="text-2xl font-bold text-blue-600">{service.minPrice}</span>
                    <span className="text-gray-500"> onwards</span>
                  </div>
                  <div className="space-y-1">
                    {service.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center text-sm text-gray-600">
                        <Star className="h-3 w-3 text-yellow-500 mr-1" fill="currentColor" />
                        {feature}
                      </div>
                    ))}
                  </div>
                  <Link href="/pricing-calculator">
                    <Button className="w-full mt-4" size="sm">
                      Calculate Price
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Calculator Preview */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Instant Pricing Calculator</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Get instant quotes with our smart pricing calculator. More copies = Better prices!
            </p>
          </div>
          
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calculator className="mr-2 h-6 w-6 text-blue-600" />
                Quick Price Estimate
              </CardTitle>
              <CardDescription>
                Select a product and quantity to see instant pricing with bulk discounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Select Product</label>
                  <select className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option>Choose a product...</option>
                    <option>Visiting Cards</option>
                    <option>Flyers</option>
                    <option>Brochures</option>
                    <option>Banners</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Quantity</label>
                  <input 
                    type="number" 
                    placeholder="Enter quantity"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                  />
                </div>
              </div>
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-center text-blue-800">
                  💡 Tip: Higher quantities get better per-unit pricing. Try 100, 500, or 1000+ copies for maximum savings!
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Get in Touch</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Have questions? Need custom quotes? We're here to help!
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <Card className="text-center">
              <CardContent className="pt-6">
                <Phone className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Call Us</h3>
                <p className="text-gray-600">+91 98765 43210</p>
                <p className="text-sm text-gray-500">Mon-Sat: 9AM-7PM</p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="pt-6">
                <Mail className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Email Us</h3>
                <p className="text-gray-600">orders@printmedia.com</p>
                <p className="text-sm text-gray-500">24/7 Support</p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="pt-6">
                <MapPin className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Visit Us</h3>
                <p className="text-gray-600">Mumbai, India</p>
                <p className="text-sm text-gray-500">By appointment only</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Join hundreds of satisfied customers who trust us with their printing needs
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/pricing-calculator">
              <Button size="lg" className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold">
                Get Instant Quote
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-600">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}