"use client";

import React from "react";
import Image from "next/image";
import { Shield, Users, Truck, Star } from "lucide-react";

const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 text-white py-32 px-8">
        <div className="max-w-5xl mx-auto relative z-10 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            About <span className="text-yellow-300">Swift Metals</span>
          </h1>
          <p className="text-xl opacity-90 max-w-3xl mx-auto mb-6">
            Delivering premium tools and equipment with speed, reliability, and a customer-first approach.
          </p>
          <button className="bg-white text-slate-800 px-8 py-4 rounded-xl hover:bg-slate-100 transition-all duration-200 font-semibold">
            Learn More
          </button>
        </div>
        <div className="absolute inset-0 bg-black/10"></div>
      </section>

      {/* Company Overview */}
      <section className="max-w-6xl mx-auto px-8 py-24 flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1">
          <Image
            src="/images/764e8e99-c09c-4162-ac41-8b9a9f5ab3aa.png" // add a relevant image in /public/images
            alt="SwiftSales overview"
            width={600}
            height={400}
            className="rounded-2xl shadow-lg object-cover"
          />
        </div>
        <div className="flex-1 space-y-6">
          <h2 className="text-3xl font-bold text-slate-900">Who We Are</h2>
          <p className="text-slate-600 text-lg leading-relaxed">
            SwiftSales is your trusted partner for premium tools and equipment. We specialize in providing high-quality products, fast delivery, and a seamless shopping experience. Our goal is to make every purchase safe, reliable, and efficient.
          </p>
          <p className="text-slate-600 text-lg leading-relaxed">
            From pliers and hammers to specialized tools and industrial equipment, we serve professionals and hobbyists alike, ensuring quality in every product.
          </p>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="bg-white py-24 px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="flex flex-col gap-6">
            <h3 className="text-2xl font-semibold text-slate-900">Our Mission</h3>
            <p className="text-slate-600">
              To empower professionals and DIY enthusiasts with high-quality tools and equipment, ensuring every project succeeds.
            </p>
          </div>
          <div className="flex flex-col gap-6">
            <h3 className="text-2xl font-semibold text-slate-900">Our Vision</h3>
            <p className="text-slate-600">
              To be the leading supplier of premium tools in the region, recognized for quality, reliability, and customer satisfaction.
            </p>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="max-w-6xl mx-auto px-8 py-24 grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          {
            icon: Shield,
            title: "Secure Shopping",
            desc: "We prioritize your safety with enterprise-grade security measures."
          },
          {
            icon: Truck,
            title: "Fast Delivery",
            desc: "Quick and reliable shipping ensures your tools reach you on time."
          },
          {
            icon: Star,
            title: "Quality Guarantee",
            desc: "We only stock high-quality products that meet professional standards."
          }
        ].map((feature, index) => (
          <div key={index} className="bg-gradient-to-br from-emerald-50 to-blue-50 p-6 rounded-2xl shadow-md text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center bg-emerald-500/20 rounded-full">
              <feature.icon className="w-6 h-6 text-emerald-600" />
            </div>
            <h4 className="text-xl font-semibold text-slate-900">{feature.title}</h4>
            <p className="text-slate-600">{feature.desc}</p>
          </div>
        ))}
      </section>

      

      {/* Call to Action */}
      <section className="py-24 px-8 bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 text-white text-center rounded-xl mx-8 my-12">
        <h2 className="text-3xl font-bold mb-4">Ready to Shop Premium Tools?</h2>
        <p className="text-lg mb-6">Browse our catalog or reach out to us for inquiries. Quality and reliability guaranteed.</p>
        <button className="bg-white text-slate-800 px-8 py-4 rounded-xl font-semibold hover:bg-slate-100 transition-all duration-200">
          Browse Products
        </button>
      </section>
    </div>
  );
};

export default AboutPage;
