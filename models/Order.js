const mongoose = require('mongoose');
const CartItem = require('./CartItem');
const Product = require('./Product');
const Discount = require('./Discount');
const AddressBook = require('./AddressBook');
const User = require('./User');
const {capitalize, formatPrice} = require("../utils/utils");
const TssMailer = require("../services/mailerService");
const {newOrderEmailSubject} = require("../mailer/emailString");
const fs = require('fs').promises;

const {Schema} = mongoose;

const orderSchema = new Schema(
    {
        order_code: String,
        user_id: {type: mongoose.Schema.Types.ObjectId, ref: "User", required: true},
        total_amount: {type: Number, required: true},
        shipping_cost: Number,
        status: {
            type: String,
            enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
            default: "pending"
        },
        payment: {
            type: String,
            enum: ['unpaid', 'pay_on_delivery', 'paystack', 'nomba', 'bank_deposit', 'manual'],
            default: 'unpaid'
        },
        payment_made_at: Date,
        cancelled_at: Date,
        refunded_at: Date,
        refunded_amount: Number,
        discount: {type: mongoose.Schema.Types.ObjectId, ref: "Discount"},
        discount_amount: Number,
        address_id: {type: mongoose.Schema.Types.ObjectId, ref: "AddressBook", required: true},
        cart: {type: mongoose.Schema.Types.ObjectId, ref: "Cart", required: true},
        cart_final_state: String,
        notes: String,
        source: {type: String}
    },
    {
        timestamps: true
    }
);

orderSchema.pre('save', async function (next) {
    if (!this.isNew)
        return next();

    try {
        const now = new Date();
        const dateStr = now.toISOString().slice(2, 8).replace(/-/g, '');
        const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '');

        const todayOrdersCount = await this.model('Order').countDocuments({
            createdAt: {
                $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
            },
        });

        const orderCode = `TSS${dateStr}${timeStr}${String(todayOrdersCount + 1).padStart(6, '0')}`;
        this.order_code = orderCode;

        const htmlFile = await fs.readFile("./mailer/emailTemplates/newOrderEmailTemplate.html", 'utf-8');

        const cartItems = await CartItem.find({parent: this.cart});
        const orderItems = await Promise.all(cartItems.map(async (cartItem) => {
            const targetProduct = await Product.findById(cartItem.product);
            return `<tr><td class="item"><img src="${(targetProduct.productImages && targetProduct.productImages.length > 0) ? targetProduct.productImages[0] : ""}" alt="Product 1">${targetProduct.brand} - ${targetProduct.name}</td><td style="text-align: center;">${cartItem.quantity}</td><td style="text-align: right;">${formatPrice(targetProduct.price)}</td></tr>`;
        }));

        let orderDiscountData = ""
        const orderAddress = await AddressBook.findById(this.address_id);
        const orderDiscount = await Discount.findById(this.discount);
        if (orderDiscount)
            orderDiscountData = orderDiscount.percentage + "% - " + orderDiscount.code
        const user = await User.findById(this.user_id);

        const processedHtmlFile = htmlFile
            .replace(/{{first_name}}/g, capitalize(user.first_name))
            .replace(/{{order_number}}/g, orderCode)
            .replace(/{{order_items}}/g, orderItems.join(''))
            .replace(/{{total_amount}}/g, formatPrice(this.total_amount))
            .replace(/{{delivery_charge}}/g, formatPrice(this.shipping_cost))
            .replace(/{{discount_data}}/g, orderDiscountData)
            .replace(/{{discount_amount}}/g, formatPrice(this.discount_amount))
            .replace(/{{order_total}}/g, formatPrice(this.total_amount - this.discount_amount))
            .replace(/{{payment_method}}/g, this.payment)
            .replace(/{{address_data}}/g, `<p>${capitalize(orderAddress.address_line_1)}</p><p>${capitalize(orderAddress.address_line_2)}</p><p>${capitalize(orderAddress.city)}, ${capitalize(orderAddress.state)}</p><p>${capitalize(orderAddress.country)}</p>`)
            .replace(/{{contact_number}}/g, orderAddress.phone_number);

        await TssMailer(user.email, newOrderEmailSubject.replace(/{{order_number}}/g, orderCode), "", processedHtmlFile);
        next();
    } catch (error) {
        next(error);
    }
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
