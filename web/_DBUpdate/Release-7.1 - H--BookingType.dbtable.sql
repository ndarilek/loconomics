﻿
/*__NOT_IN_BATCH__*/EXEC sp_msforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT all'
/*__NOT_IN_BATCH__*/EXEC sp_msforeachtable 'ALTER TABLE ? DISABLE TRIGGER  all'
DELETE FROM BookingType 
INSERT INTO [bookingtype]
   ([BookingTypeID]
   ,[BookingTypeName]
   ,[BookingTypeDescription]
   ,[CreatedDate]
   ,[UpdatedDate]
   ,[ModifiedBy]
   ,[Active]
   ,[ServiceFeeFixed]
   ,[ServiceFeePercentage]
   ,[PaymentProcessingFeePercentage]
   ,[PaymentProcessingFeeFixed])
VALUES
   ('1'
   ,'marketplaceBooking'
   ,'Booked through the Loconomics Marketplace. Done by the client.'
   ,'8/29/2015 1:09:00 PM'
   ,'8/29/2015 1:09:00 PM'
   ,'jd'
   ,'True'
   ,@ServiceFeeFixed
   ,@ServiceFeePercentage
   ,'2.90'
   ,'0.30')
INSERT INTO [bookingtype]
   ([BookingTypeID]
   ,[BookingTypeName]
   ,[BookingTypeDescription]
   ,[CreatedDate]
   ,[UpdatedDate]
   ,[ModifiedBy]
   ,[Active]
   ,[ServiceFeeFixed]
   ,[ServiceFeePercentage]
   ,[PaymentProcessingFeePercentage]
   ,[PaymentProcessingFeeFixed])
VALUES
   ('2'
   ,'bookNowBooking'
   ,'Booked from a service professional website. Done by the client.'
   ,'8/29/2015 1:09:00 PM'
   ,'8/29/2015 1:09:00 PM'
   ,'jd'
   ,'True'
   ,@ServiceFeeFixed
   ,@ServiceFeePercentage
   ,'2.90'
   ,'0.30')
INSERT INTO [bookingtype]
   ([BookingTypeID]
   ,[BookingTypeName]
   ,[BookingTypeDescription]
   ,[CreatedDate]
   ,[UpdatedDate]
   ,[ModifiedBy]
   ,[Active]
   ,[ServiceFeeFixed]
   ,[ServiceFeePercentage]
   ,[PaymentProcessingFeePercentage]
   ,[PaymentProcessingFeeFixed])
VALUES
   ('3'
   ,'serviceProfessionalBooking'
   ,'Booked by the service professional. Done by the service professional'
   ,'8/29/2015 1:09:00 PM'
   ,'2/8/2016 12:00:00 AM'
   ,'jd'
   ,'True'
   ,@ServiceFeeFixed
   ,@ServiceFeePercentage
   ,'0.00'
   ,'0.00')
INSERT INTO [bookingtype]
   ([BookingTypeID]
   ,[BookingTypeName]
   ,[BookingTypeDescription]
   ,[CreatedDate]
   ,[UpdatedDate]
   ,[ModifiedBy]
   ,[Active]
   ,[ServiceFeeFixed]
   ,[ServiceFeePercentage]
   ,[PaymentProcessingFeePercentage]
   ,[PaymentProcessingFeeFixed])
VALUES
   ('4'
   ,'exchangeBooking'
   ,'Booked as an exchange booking. Done by the client'
   ,'8/29/2015 1:09:00 PM'
   ,'2/8/2016 12:00:00 AM'
   ,'jd'
   ,'True'
   ,@ServiceFeeFixed
   ,@ServiceFeePercentage
   ,'0.00'
   ,'0.00')
INSERT INTO [bookingtype]
   ([BookingTypeID]
   ,[BookingTypeName]
   ,[BookingTypeDescription]
   ,[CreatedDate]
   ,[UpdatedDate]
   ,[ModifiedBy]
   ,[Active]
   ,[ServiceFeeFixed]
   ,[ServiceFeePercentage]
   ,[PaymentProcessingFeePercentage]
   ,[PaymentProcessingFeeFixed])
VALUES
   ('5'
   ,'partnerBooking'
   ,'Booked through a White Label marketplace/site. Done by the client.'
   ,'8/29/2015 1:09:00 PM'
   ,'8/29/2015 1:09:00 PM'
   ,'jd'
   ,'True'
   ,@ServiceFeeFixed
   ,@ServiceFeePercentage
   ,'2.90'
   ,'0.30')

/*__NOT_IN_BATCH__*/EXEC sp_msforeachtable 'ALTER TABLE ? WITH CHECK CHECK CONSTRAINT all'
/*__NOT_IN_BATCH__*/EXEC sp_msforeachtable 'ALTER TABLE ? ENABLE TRIGGER  all'
