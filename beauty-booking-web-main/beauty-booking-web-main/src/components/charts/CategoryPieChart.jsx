import React from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const PIE_COLORS = ["#D6597B", "#C99A4E", "#6E8A64", "#8E7CB8", "#7C93B8"];

export const CategoryPieChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={260}>
    <PieChart>
      <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
        {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
      </Pie>
      <Tooltip />
      <Legend wrapperStyle={{ fontSize: 11 }} />
    </PieChart>
  </ResponsiveContainer>
);

export default CategoryPieChart;
