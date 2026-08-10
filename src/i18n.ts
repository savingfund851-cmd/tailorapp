export const translations = {
  en: {
    appName: "TailorApp",
    home: "Home",
    catalog: "Catalog",
    orders: "Orders",
    invoice: "Invoice",
    login: "Login",
    register: "Register",
    logout: "Logout",
    productName: "Product Name",
    price: "Price",
    stock: "Stock",
    addToCart: "Add to Cart",
    placeOrder: "Place Order",
    orderPlaced: "Order Placed Successfully",
    cutting: "Cutting",
    sewing: "Sewing",
    finishing: "Finishing",
    delivery: "Delivery",
    downloadInvoice: "Download Invoice",
    invoiceTitle: "Invoice",
    total: "Total",
    quantity: "Qty",
    customer: "Customer",
    welcomeMessage: "Welcome to TailorApp",
    noOrders: "No orders found.",
    orderStatus: "Status",
    viewDetails: "View Details",
    language: "English"
  },
  bn: {
    appName: "টেইলর অ্যাপ",
    home: "হোম",
    catalog: "ক্যাটালগ",
    orders: "অর্ডার",
    invoice: "ইনভয়েস",
    login: "লগইন",
    register: "রেজিস্টার",
    logout: "লগআউট",
    productName: "পণ্যের নাম",
    price: "মূল্য",
    stock: "স্টক",
    addToCart: "কার্টে যোগ করুন",
    placeOrder: "অর্ডার করুন",
    orderPlaced: "অর্ডার সফলভাবে সম্পন্ন হয়েছে",
    cutting: "কাটিং",
    sewing: "সেলাই",
    finishing: "ফিনিশিং",
    delivery: "ডেলিভারি",
    downloadInvoice: "ইনভয়েস ডাউনলোড করুন",
    invoiceTitle: "ইনভয়েস",
    total: "মোট",
    quantity: "পরিমাণ",
    customer: "গ্রাহক",
    welcomeMessage: "টেইলর অ্যাপ এ স্বাগতম",
    noOrders: "কোন অর্ডার পাওয়া যায়নি।",
    orderStatus: "স্ট্যাটাস",
    viewDetails: "বিস্তারিত দেখুন",
    language: "বাংলা"
  }
};

import { useState, useEffect } from 'react';

type Lang = 'en' | 'bn';

export function useTranslation(lang: Lang) {
  return translations[lang];
}
