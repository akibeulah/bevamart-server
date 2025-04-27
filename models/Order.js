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
            enum: ['pending', 'vendor_preparing_order', 'order_ready_for_delivery', 'order_out_for_delivery', 'delivery_confirmed'],
            default: "pending"
        },
        payment: {
            type: String,
            enum: ['unpaid', 'pay_on_delivery', 'paystack', 'refunded'],
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
        source: {type: String},
        orderPSPaymentCode: {type: String},
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

        const todayOrdersCount = await this.model('Order').countDocuments({
            createdAt: {
                $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
            },
        });

        const orderCode = `BM${dateStr}${String(todayOrdersCount + 1).padStart(6, '0')}`;
        this.order_code = orderCode;

        const htmlFile = await fs.readFile("./mailer/emailTemplates/newOrderEmailTemplate.html", 'utf-8');

        const cartItems = await CartItem.find({parent: this.cart})
            .populate('product')
            .populate({
                path: 'variant',
                populate: {
                    path: 'attributeOptions',
                    populate: {
                        path: 'attribute'
                    }
                }
            });
        const orderItems = await Promise.all(cartItems.map(async (cartItem) => {
            const product = cartItem.product;
            let itemName = `${product.brand} - ${product.name}`;
            let itemImage = (product.productImages && product.productImages.length > 0) ? product.productImages[0] : "";
            let itemPrice = formatPrice(cartItem.price);

            if (cartItem.variant) {
                if (cartItem.variant.images && cartItem.variant.images.length > 0) {
                    itemImage = cartItem.variant.images[0];
                }

                if (cartItem.variant.attributeOptions && cartItem.variant.attributeOptions.length > 0) {
                    const variantOptions = cartItem.variant.attributeOptions
                        .map(opt => `${opt.attribute.name}: ${opt.displayName}`)
                        .join(', ');
                    itemName += ` (${variantOptions})`;
                }
            }

            return `<tr><td class="item"><img src="${itemImage}" alt="Product">${itemName}</td><td style="text-align: center;">${cartItem.quantity}</td><td style="text-align: right;">${itemPrice}</td></tr>`;
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

orderSchema.methods.getParsedCartItems = function() {
    if (!this.cart_final_state) return [];

    try {
        return JSON.parse(this.cart_final_state);
    } catch (error) {
        console.error('Error parsing cart_final_state:', error);
        return [];
    }
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
