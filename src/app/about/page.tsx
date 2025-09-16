'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  Award, 
  Users, 
  Clock, 
  Truck, 
  Shield, 
  Star, 
  Target, 
  Lightbulb,
  CheckCircle,
  TrendingUp,
  Heart
} from "lucide-react"

export default function AboutPage() {
  const stats = [
    { icon: Users, label: "Happy Customers", value: "10,000+" },
    { icon: Clock, label: "Years Experience", value: "15+" },
    { icon: Truck, label: "Orders Delivered", value: "50,000+" },
    { icon: Award, label: "Awards Won", value: "25+" }
  ]

  const values = [
    {
      icon: Target,
      title: "Quality First",
      description: "We never compromise on quality. Every print job undergoes strict quality checks to ensure perfection."
    },
    {
      icon: Clock,
      title: "Timely Delivery",
      description: "We understand the importance of deadlines. Our streamlined process ensures on-time delivery every time."
    },
    {
      icon: Users,
      title: "Customer Centric",
      description: "Your satisfaction is our priority. We work closely with you to bring your vision to life."
    },
    {
      icon: Lightbulb,
      title: "Innovation",
      description: "We stay ahead with the latest printing technology and techniques to deliver superior results."
    }
  ]

  const services = [
    {
      title: "Digital Printing",
      description: "High-quality digital printing for small to medium runs with quick turnaround times.",
      features: ["Full color printing", "Variable data printing", "On-demand printing", "Cost-effective"]
    },
    {
      title: "Offset Printing",
      description: "Traditional offset printing for large volume projects with consistent quality.",
      features: ["Large volume capacity", "Consistent color", "Cost-effective for bulk", "Premium finish"]
    },
    {
      title: "Large Format Printing",
      description: "Eye-catching large format prints for banners, hoardings, and promotional materials.",
      features: ["Weather resistant", "High resolution", "Custom sizes", "Vibrant colors"]
    },
    {
      title: "Custom Design Services",
      description: "Professional design services to help you create impactful marketing materials.",
      features: ["Expert designers", "Brand consultation", "Multiple revisions", "Print-ready files"]
    }
  ]

  const testimonials = [
    {
      name: "Rajesh Sharma",
      company: "Tech Solutions Pvt Ltd",
      text: "Outstanding quality and service! Our visiting cards look professional and were delivered ahead of schedule.",
      rating: 5
    },
    {
      name: "Priya Patel",
      company: "Marketing Agency",
      text: "The brochure printing exceeded our expectations. Great attention to detail and competitive pricing.",
      rating: 5
    },
    {
      name: "Amit Kumar",
      company: "Event Management Co",
      text: "Reliable partner for all our event printing needs. Always delivers on time with excellent quality.",
      rating: 5
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-purple-700 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-4 bg-white text-blue-600">About Us</Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Your Trusted Printing Partner
            <br />
            <span className="text-yellow-300">Since 2009</span>
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto">
            We are committed to delivering exceptional printing solutions that help businesses 
            make a lasting impression with premium quality and unmatched service.
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="h-8 w-8 text-blue-600" />
                </div>
                <div className="text-3xl font-bold text-blue-600 mb-2">{stat.value}</div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Story</h2>
            <p className="text-lg text-gray-600">
              From a small printing shop to a industry leader
            </p>
          </div>
          
          <Card>
            <CardContent className="p-8">
              <div className="prose prose-lg max-w-none">
                <p className="text-lg text-gray-700 mb-6">
                  Founded in 2009, Print Media Solutions began as a small printing shop with a big vision - 
                  to provide businesses with high-quality printing solutions that make a real impact.
                </p>
                
                <p className="text-gray-700 mb-6">
                  What started as a modest operation with just two printing machines has grown into a 
                  comprehensive printing powerhouse serving clients across India. Our journey has been 
                  marked by continuous investment in technology, unwavering commitment to quality, 
                  and a deep understanding of our customers' needs.
                </p>
                
                <p className="text-gray-700 mb-6">
                  Today, we pride ourselves on being more than just a printing company. We are your 
                  strategic partner in visual communication, helping businesses of all sizes create 
                  professional, impactful printed materials that drive results.
                </p>
                
                <div className="bg-blue-50 p-6 rounded-lg mt-8">
                  <h3 className="text-xl font-semibold mb-3 text-blue-800">Our Mission</h3>
                  <p className="text-blue-700">
                    To empower businesses with exceptional printing solutions that combine quality, 
                    innovation, and outstanding service, helping them communicate effectively and 
                    grow their brand presence.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-16 bg-gray-100">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Core Values</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              The principles that guide everything we do
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <Card key={index} className="text-center h-full">
                <CardHeader>
                  <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <value.icon className="h-8 w-8 text-blue-600" />
                  </div>
                  <CardTitle className="text-lg">{value.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Our Services */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">What We Offer</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Comprehensive printing solutions for all your business needs
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {services.map((service, index) => (
              <Card key={index} className="h-full">
                <CardHeader>
                  <CardTitle className="text-xl">{service.title}</CardTitle>
                  <CardDescription>{service.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {service.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        <span className="text-sm text-gray-600">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-gray-100">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">What Our Clients Say</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Don't just take our word for it - hear from our satisfied customers
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="h-full">
                <CardContent className="p-6">
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-yellow-500 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-4 italic">
                    "{testimonial.text}"
                  </p>
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-gray-600">{testimonial.company}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose Print Media Solutions?</h2>
            <p className="text-lg text-gray-600">
              Setting the standard in printing excellence
            </p>
          </div>
          
          <Card>
            <CardContent className="p-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-semibold mb-4 flex items-center">
                    <TrendingUp className="h-5 w-5 text-blue-600 mr-2" />
                    Quality Assurance
                  </h3>
                  <p className="text-gray-700 mb-6">
                    Every project undergoes rigorous quality checks at multiple stages, 
                    ensuring you receive only the finest printed materials.
                  </p>
                  
                  <h3 className="text-xl font-semibold mb-4 flex items-center">
                    <Truck className="h-5 w-5 text-blue-600 mr-2" />
                    Fast Turnaround
                  </h3>
                  <p className="text-gray-700">
                    With state-of-the-art equipment and efficient processes, we deliver 
                    your projects on time, every time.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-xl font-semibold mb-4 flex items-center">
                    <Shield className="h-5 w-5 text-blue-600 mr-2" />
                    Competitive Pricing
                  </h3>
                  <p className="text-gray-700 mb-6">
                    We offer transparent pricing with no hidden costs, providing excellent 
                    value for your investment in quality printing.
                  </p>
                  
                  <h3 className="text-xl font-semibold mb-4 flex items-center">
                    <Heart className="h-5 w-5 text-blue-600 mr-2" />
                    Personalized Service
                  </h3>
                  <p className="text-gray-700">
                    Our dedicated team works closely with you to understand your needs 
                    and deliver solutions that exceed expectations.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Work With Us?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Experience the difference of working with a printing partner who truly cares about your success
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/pricing-calculator" className="inline-block">
              <button className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-8 py-3 rounded-lg text-lg font-medium">
                Get Started
              </button>
            </a>
            <a href="/contact" className="inline-block">
              <button className="border-2 border-white text-white hover:bg-white hover:text-blue-600 px-8 py-3 rounded-lg text-lg font-medium">
                Contact Us
              </button>
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}