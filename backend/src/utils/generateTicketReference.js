const generateTicketReference = () => {
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TKT-${randomPart}`;
};

module.exports = generateTicketReference;
