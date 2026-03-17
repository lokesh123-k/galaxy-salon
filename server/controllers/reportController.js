const Bill = require('../models/Bill');
const Customer = require('../models/Customer');
const Appointment = require('../models/Appointment');
const Product = require('../models/Product');
const Employee = require('../models/Employee');

exports.getDashboard = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    // Today's stats
    const todayBills = await Bill.find({ createdAt: { $gte: today, $lt: tomorrow }, status: 'completed' });
    const todayRevenue = todayBills.reduce((sum, b) => sum + b.totalAmount, 0);

    // Month stats
    const monthBills = await Bill.find({ createdAt: { $gte: monthStart, $lte: monthEnd }, status: 'completed' });
    const monthRevenue = monthBills.reduce((sum, b) => sum + b.totalAmount, 0);

    // Today's appointments
    const todayAppointments = await Appointment.countDocuments({
      date: { $gte: today, $lt: tomorrow },
      status: { $nin: ['cancelled'] },
    });

    // Low stock products
    const lowStockProducts = await Product.countDocuments({
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
      isActive: true,
    });

    // Total customers
    const totalCustomers = await Customer.countDocuments();

    // Total employees
    const activeEmployees = await Employee.countDocuments({ isActive: true });

    res.json({
      today: { bills: todayBills.length, revenue: todayRevenue },
      month: { bills: monthBills.length, revenue: monthRevenue },
      todayAppointments,
      lowStockProducts,
      totalCustomers,
      activeEmployees,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    let dateFormat;
    if (groupBy === 'day') dateFormat = '%Y-%m-%d';
    else if (groupBy === 'week') dateFormat = '%Y-W%V';
    else dateFormat = '%Y-%m';

    const salesData = await Bill.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, status: 'completed' } },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          totalRevenue: { $sum: '$totalAmount' },
          totalBills: { $sum: 1 },
          totalDiscount: { $sum: '$discount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const totalRevenue = salesData.reduce((sum, d) => sum + d.totalRevenue, 0);
    const totalBills = salesData.reduce((sum, d) => sum + d.totalBills, 0);

    res.json({ salesData, totalRevenue, totalBills });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTopServices = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const match = { status: 'completed' };

    if (startDate && endDate) {
      match.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const topServices = await Bill.aggregate([
      { $match: match },
      { $unwind: '$services' },
      {
        $group: {
          _id: '$services.serviceName',
          count: { $sum: 1 },
          revenue: { $sum: '$services.price' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.json({ topServices });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTopProducts = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const match = { status: 'completed' };

    if (startDate && endDate) {
      match.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const topProducts = await Bill.aggregate([
      { $match: match },
      { $unwind: '$products' },
      {
        $group: {
          _id: '$products.productName',
          count: { $sum: '$products.quantity' },
          revenue: { $sum: { $multiply: ['$products.price', '$products.quantity'] } },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.json({ topProducts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPaymentMethodBreakdown = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const match = { status: 'completed' };

    if (startDate && endDate) {
      match.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const breakdown = await Bill.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$paymentMethod',
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({ breakdown });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getEmployeePerformance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const match = { status: 'completed' };

    if (startDate && endDate) {
      match.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const performance = await Bill.aggregate([
      { $match: match },
      { $unwind: '$services' },
      {
        $group: {
          _id: '$services.employeeName',
          serviceCount: { $sum: 1 },
          revenue: { $sum: '$services.price' },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    res.json({ performance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
